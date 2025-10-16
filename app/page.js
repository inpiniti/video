"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Gauge,
  Maximize2,
} from "lucide-react";
import activeVideo from "@/lib/activeVideo";
import streamManager from "@/lib/streamManager";
import { Spinner } from "@/components/ui/spinner";

const Page = () => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch("/api/fetch-file-list?folderName=/videos");
        const data = await response.json();
        setVideos(data);
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      }
    };

    fetchVideos();
  }, []);

  // Calculate total size in GB
  const totalSizeGB =
    videos.reduce((sum, video) => sum + (video.size || 0), 0) / 1024 ** 3;

  return (
    <div className="w-screen h-screen bg-neutral-50">
      <Header totalSizeGB={totalSizeGB} />
      <div className="bg-white h-16 w-full"></div>
      <Content videos={videos} />
    </div>
  );
};

export default Page;

const Header = ({ totalSizeGB }) => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleAddClick = () => {
    router.push("/add");
  };

  return (
    <div
      className={`fixed top-0 w-full h-16 flex items-center justify-between px-4 transition-transform duration-300 ease-in-out z-50 backdrop-blur-sm ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="text-sm font-medium text-gray-700">
        {totalSizeGB.toFixed(2)} GB / 1 TB
      </div>
      <div className="text-2xl font-bold absolute left-1/2 transform -translate-x-1/2">
        Instagram
      </div>
      <button
        onClick={handleAddClick}
        className="w-10 h-10 bg-black rounded-full flex items-center justify-center hover:bg-opacity-70 transition-all shadow-md"
        aria-label="추가"
      >
        <Plus className="text-white" size={20} strokeWidth={2} />
      </button>
    </div>
  );
};

const Content = ({ videos }) => {
  return (
    <div className="sm:px-4 pt-4 mx-auto">
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 columns-3xl columns-4xl gap-4">
        {videos.map((video) => (
          <Item key={video.fs_id} video={video} />
        ))}
      </div>
    </div>
  );
};

const Item = ({ video }) => {
  const [streamingUrl, setStreamingUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [, setIsFullscreen] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const itemRef = useRef(null);
  const videoRef = useRef(null);
  const streamingUrlRef = useRef(streamingUrl);
  const MAX_RETRIES = 3; // Maximum retry attempts
  const SPEED_OPTIONS = [1, 1.25, 1.5, 2]; // Speed cycle

  const loadAndPlayVideo = useCallback(() => {
    // Don't retry if max retries reached
    if (errorCount >= MAX_RETRIES) {
      console.warn(
        `Max retries (${MAX_RETRIES}) reached for video:`,
        video.fs_id
      );
      return;
    }
    // Request to become the active video. activeVideo manager will notify subscribers.
    activeVideo.requestActive(video.fs_id);
  }, [video.fs_id, errorCount]);

  // Subscribe to activeVideo changes: only the active item loads streaming
  useEffect(() => {
    streamingUrlRef.current = streamingUrl;
  }, [streamingUrl]);
  useEffect(() => {
    // Callback from activeVideo (focus play/pause)
    const onActive = (activeSet) => {
      const isActive = activeSet && activeSet.has && activeSet.has(video.fs_id);

      if (isActive) {
        if (videoRef.current) videoRef.current.play().catch(() => {});
      } else {
        // 화면에서 벗어나면 일시정지
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }
    };

    // Callback from streamManager to start/stop streaming
    const streamCb = (start) => {
      if (start) {
        if (!streamingUrlRef.current) {
          setIsLoading(true);
          const proxyUrl = `/api/terabox-stream?fileId=${video.fs_id}`;
          setStreamingUrl(proxyUrl);
          streamingUrlRef.current = proxyUrl;
        }
      } else {
        // stop streaming: release src but keep loaded state if needed
        if (videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.removeAttribute("src");
            videoRef.current.load();
          } catch {}
        }
        setStreamingUrl(null);
        streamingUrlRef.current = null;
        setVideoLoaded(false);
      }
    };

    activeVideo.subscribe(onActive);
    streamManager.subscribe(video.fs_id, streamCb);

    return () => {
      // cleanup subscriptions
      activeVideo.unsubscribe(onActive);
      streamManager.unsubscribe(video.fs_id);
      // ensure we finish streaming slot when unmounting
      try {
        streamManager.finish(video.fs_id);
      } catch {
        // ignore
      }
    };
  }, [video.fs_id]);

  // 이전 동작: 마운트 시 바로 스트리밍 요청하던 코드 제거
  // 이제는 IntersectionObserver에서 화면에 보일 때만 스트리밍을 요청하고,
  // 화면을 벗어나면 스트리밍을 중단(소스 제거)하여 브라우저가 버퍼를 잡지 않도록 함.

  // LRU 캐시: 오래된 비디오 언로드
  useEffect(() => {
    if (streamingUrl && videoLoaded) {
      const videosToUnload = activeVideo.markLoaded(video.fs_id);

      // 현재 비디오가 언로드 대상이면 정리
      if (videosToUnload && videosToUnload.has(video.fs_id)) {
        setStreamingUrl(null);
        setVideoLoaded(false);
        if (videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.removeAttribute("src");
            videoRef.current.load();
          } catch {
            // ignore
          }
        }
      }
    }
  }, [streamingUrl, videoLoaded, video.fs_id]);

  // Intersection Observer로 화면에 보이는지 감지
  useEffect(() => {
    const currentRef = itemRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // track visibility for playback when stream becomes available
        setIsVisible(entry.isIntersecting);
        // 화면에 보이면 자동 로드 및 재생
        if (entry.isIntersecting && !streamingUrl) {
          // 화면에 들어오면 스트리밍을 요청하고 active로 등록
          // activeVideo.requestActive가 재생을 담당함
          streamManager.requestStream(video.fs_id);
          loadAndPlayVideo();
        }

        // 화면에서 벗어나면 비디오 일시정지 및 active 해제
        if (!entry.isIntersecting) {
          // 화면을 벗어나면 active 해제 및 스트리밍 중단
          activeVideo.clearActive(video.fs_id);
          try {
            // stop streaming slot and remove source so browser won't keep downloading
            streamManager.finish(video.fs_id);
          } catch (err) {
            console.error("streamManager.finish error on leave:", err);
          }
          if (videoRef.current) {
            try {
              videoRef.current.pause();
              videoRef.current.removeAttribute("src");
              videoRef.current.load();
            } catch {}
            setIsPlaying(false);
            setStreamingUrl(null);
            setVideoLoaded(false);
          }
        } else if (entry.isIntersecting && videoRef.current && streamingUrl) {
          videoRef.current.play().catch(() => {
            // 자동 재생 실패 시 무시 (브라우저 정책)
          });
          setIsPlaying(true);
        }
      },
      {
        threshold: 0.5, // 50% 이상 보이면 재생
      }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [streamingUrl, loadAndPlayVideo, video.fs_id]);

  // If the stream URL becomes available while the item is visible,
  // ensure playback is started. This fixes cases where the stream slot
  // is granted after the element entered view and play was attempted
  // earlier (race condition).
  useEffect(() => {
    if (streamingUrl && isVisible && videoRef.current) {
      // try to play when source is set
      videoRef.current.play().catch(() => {
        // ignore autoplay policy failures
      });
    }
  }, [streamingUrl, isVisible]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleImageClick = async () => {
    if (!streamingUrl) {
      loadAndPlayVideo();
    }
  };

  // Control functions
  const handleDownload = (e) => {
    e.stopPropagation();
    if (!streamingUrl) return;
    const link = document.createElement("a");
    link.href = streamingUrl;
    link.download = video.server_filename || "video.mp4";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSkipBackward = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      videoRef.current.currentTime - 10
    );
  };

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleSkipForward = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(
      videoRef.current.duration,
      videoRef.current.currentTime + 10
    );
  };

  const handleSpeedChange = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const currentIndex = SPEED_OPTIONS.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    const newRate = SPEED_OPTIONS[nextIndex];
    videoRef.current.playbackRate = newRate;
    setPlaybackRate(newRate);
  };

  const handleFullscreen = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    // iOS Safari 지원
    if (videoRef.current.webkitEnterFullscreen) {
      try {
        videoRef.current.webkitEnterFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error("iOS Fullscreen error:", err);
      }
      return;
    }

    // 일반 브라우저 전체화면
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen().catch((err) => {
        console.error("Fullscreen error:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleProgressClick = (e) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    videoRef.current.currentTime = duration * percentage;
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="break-inside-avoid mb-4 bg-white" ref={itemRef}>
      <div className="flex gap-2 p-2 items-start">
        <img
          src={video.thumbs.icon}
          alt="TeraBox"
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-medium text-sm truncate">
            {video.server_filename}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 truncate">
              {video.fs_id}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 flex-shrink-0">
              {((video.size || 0) / 1024 ** 2).toFixed(2)} MB
            </span>
          </div>
        </div>
      </div>
      <div
        className="relative w-full cursor-pointer aspect-square"
        onClick={handleImageClick}
      >
        {/* 썸네일 이미지 - 항상 표시하고 비디오 로딩 중에도 보임 */}
        {(!streamingUrl || isLoading || !videoLoaded) && (
          <img
            className="w-full block"
            src={video.thumbs.url3}
            alt="thumbnail"
          />
        )}

        {/* 에러 표시 */}
        {errorCount >= MAX_RETRIES && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white text-center p-4">
              <p className="text-sm">재생 실패</p>
              <p className="text-xs mt-1">최대 재시도 횟수 초과</p>
            </div>
          </div>
        )}

        {/* 로딩 인디케이터 */}
        {isLoading && errorCount < MAX_RETRIES && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="w-12 h-12 text-white" />
          </div>
        )}

        {/* 비디오 엘리먼트 - 항상 렌더링하되, 로드 전까지는 숨김 */}
        {streamingUrl && (
          <video
            ref={videoRef}
            className="w-full block"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: videoLoaded ? 1 : 0,
              transition: "opacity 200ms ease",
            }}
            autoPlay
            playsInline
            loop
            muted
            preload="auto"
            src={streamingUrl}
            onLoadedData={() => {
              setVideoLoaded(true);
              setIsLoading(false);
              setIsPlaying(true);
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
                // ensure playback starts once data is loaded
                videoRef.current.play().catch(() => {});
              }
              // 이전 동작은 로드되면 즉시 스트리밍 슬롯을 해제했으나,
              // 롤백 요구로 인해 스트리밍은 화면에서 벗어나면 해제하도록 한다.
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);
              }
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              console.error(
                "Video playback error:",
                e,
                "Retry count:",
                errorCount
              );
              setIsLoading(false);
              setStreamingUrl(null);
              setVideoLoaded(false);
              setErrorCount((prev) => prev + 1);
              try {
                streamManager.finish(video.fs_id);
              } catch (err) {
                console.error("streamManager.finish error:", err);
              }
            }}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      <div className="flex items-center justify-center gap-1 px-2">
        {/* Download */}
        <button
          onClick={handleDownload}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          title="다운로드"
        >
          <Download className="w-4 h-4 text-gray-700" />
        </button>

        {/* 10초 뒤로 */}
        <button
          onClick={handleSkipBackward}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          title="10초 뒤로"
        >
          <SkipBack className="w-4 h-4 text-gray-700" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          title={isPlaying ? "일시정지" : "재생"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-gray-700" />
          ) : (
            <Play className="w-4 h-4 text-gray-700" />
          )}
        </button>

        {/* 10초 앞으로 */}
        <button
          onClick={handleSkipForward}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          title="10초 앞으로"
        >
          <SkipForward className="w-4 h-4 text-gray-700" />
        </button>

        {/* 속도 */}
        <button
          onClick={handleSpeedChange}
          className="px-3 py-2 hover:bg-gray-200 rounded-full transition-colors flex items-center gap-1"
          title="재생 속도"
        >
          <Gauge className="w-4 h-4 text-gray-700" />
          <span className="text-xs font-medium text-gray-700">
            x{playbackRate}
          </span>
        </button>

        {/* 전체화면 */}
        <button
          onClick={handleFullscreen}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          title="전체화면"
        >
          <Maximize2 className="w-4 h-4 text-gray-700" />
        </button>
      </div>
      <div className="py-2">
        {/* 재생바 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 min-w-[35px] text-right">
            {formatTime(currentTime)}
          </span>
          <div
            className="flex-1 h-1 bg-gray-200 rounded-full cursor-pointer relative overflow-hidden"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-black transition-all duration-100"
              style={{
                width:
                  duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
              }}
            />
          </div>
          <span className="text-xs text-gray-600 min-w-[35px]">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

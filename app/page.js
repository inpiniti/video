"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import activeVideo from "@/lib/activeVideo";
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
    <div className="w-screen h-screen">
      <Header totalSizeGB={totalSizeGB} />
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
      className={`fixed top-0 w-full h-16 flex items-center justify-between px-4 transition-transform duration-300 ease-in-out z-50 bg-white bg-opacity-95 backdrop-blur-sm ${
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
    <div className="pt-16 sm:px-2 mx-auto">
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-2">
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
  const [, setIsPlaying] = useState(false);
  const [, setPlaybackRate] = useState(1);
  const [, setIsFullscreen] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const itemRef = useRef(null);
  const videoRef = useRef(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);
  const MAX_RETRIES = 3; // Maximum retry attempts

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
    const onActive = (activeSet) => {
      const isActive = activeSet && activeSet.has && activeSet.has(video.fs_id);

      if (isActive) {
        if (!streamingUrl) {
          setIsLoading(true);
          const proxyUrl = `/api/terabox-stream?fileId=${video.fs_id}`;
          setStreamingUrl(proxyUrl);
        }
        if (videoRef.current) videoRef.current.play().catch(() => {});
      } else {
        if (streamingUrl) {
          setStreamingUrl(null);
          setVideoLoaded(false);
          setIsLoading(false);
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
    };

    activeVideo.subscribe(onActive);
    return () => activeVideo.unsubscribe(onActive);
  }, [streamingUrl, video.fs_id]);

  // Intersection Observer로 화면에 보이는지 감지
  useEffect(() => {
    const currentRef = itemRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 화면에 보이면 자동 로드 및 재생
        if (entry.isIntersecting && !streamingUrl) {
          loadAndPlayVideo();
        }

        // 화면에서 벗어나면 비디오 일시정지 및 active 해제
        if (!entry.isIntersecting) {
          activeVideo.clearActive(video.fs_id);
          if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
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

  const handleVideoClick = async (e) => {
    if (!videoRef.current) return;

    // 비디오가 로드되지 않았으면 로드 시작
    if (!streamingUrl) {
      loadAndPlayVideo();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const clickPosition = x / width; // 0 (left) to 1 (right)

    // 클릭 카운트 증가
    clickCountRef.current += 1;

    // Clear previous timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // Wait 300ms to detect multiple clicks
    clickTimerRef.current = setTimeout(() => {
      const clickCount = clickCountRef.current;
      clickCountRef.current = 0; // Reset

      if (clickCount === 1) {
        // Single click: seek forward/backward 5 seconds
        if (clickPosition < 0.5) {
          // Left side: -5 seconds
          videoRef.current.currentTime = Math.max(
            0,
            videoRef.current.currentTime - 5
          );
        } else {
          // Right side: +5 seconds
          videoRef.current.currentTime = Math.min(
            videoRef.current.duration,
            videoRef.current.currentTime + 5
          );
        }
      } else if (clickCount === 2) {
        // Double click: toggle playback rate (1x <-> 2x)
        const newRate = videoRef.current.playbackRate === 1 ? 2 : 1;
        videoRef.current.playbackRate = newRate;
        setPlaybackRate(newRate);
      } else if (clickCount >= 3) {
        // Triple click: toggle fullscreen
        if (!document.fullscreenElement) {
          videoRef.current.requestFullscreen().catch((err) => {
            console.error("Fullscreen error:", err);
          });
          setIsFullscreen(true);
        } else {
          document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    }, 300);
  };

  const handleImageClick = async () => {
    if (!streamingUrl) {
      loadAndPlayVideo();
    }
  };

  return (
    <div className="break-inside-avoid mb-2" ref={itemRef}>
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
              display: videoLoaded ? "block" : "none",
            }}
            autoPlay
            playsInline
            loop
            muted
            preload="auto"
            src={streamingUrl}
            onClick={handleVideoClick}
            onLoadedData={() => {
              setVideoLoaded(true);
              setIsLoading(false);
              setIsPlaying(true);
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
            }}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>
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
    </div>
  );
};

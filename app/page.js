"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useVirtualizer } from "@tanstack/react-virtual";

const Page = () => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response1 = await fetch(
          "/api/fetch-file-list?folderName=/videos1"
        );
        const data1 = await response1.json();
        const response2 = await fetch(
          "/api/fetch-file-list?folderName=/videos2"
        );
        const data2 = await response2.json();
        const response3 = await fetch(
          "/api/fetch-file-list?folderName=/videos3"
        );
        const data3 = await response3.json();
        setVideos([...data1, ...data2, ...data3]);
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
    <div className="w-screen bg-neutral-100">
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

// Content: tanstack virtual 적용 (variable heights, overscan: 5)
const Content = ({ videos }) => {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: videos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320, // 대략 예상 높이
    overscan: 5, // 현재 포커스 주변 ±5 정도 렌더링
  });

  return (
    <div className="pt-16 sm:px-2 mx-auto">
      <div
        ref={parentRef}
        className="w-full mx-auto"
        style={{ height: "calc(100vh - 4rem)", overflowY: "auto" }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const video = videos[virtualRow.index];
            if (!video) return null;
            return (
              <Item
                key={virtualRow.key}
                video={video}
                virtualRow={virtualRow}
                measureElement={(el) => {
                  try {
                    rowVirtualizer.measureElement(el);
                  } catch (e) {
                    // ignore
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Item: poster 이미지 로드 기반으로 높이 계산하고 virtualizer에 측정 요청
const Item = ({ video, virtualRow, measureElement }) => {
  const [isLoading, setIsLoading] = useState(false);
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef(null);

  // 계산 및 측정 함수
  const computeHeightAndMeasure = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;

    // 요소의 너비를 참조
    const width = el.clientWidth || el.offsetWidth;
    // 썸네일 URL의 자연 비율을 이용해 높이 계산
    const thumbUrl = video?.thumbs?.url3;
    // ensure data-index is set so virtualizer can map element to item
    if (virtualRow && el) el.dataset.index = String(virtualRow.index);

    if (!thumbUrl) {
      // poster가 없으면 기본 estimate로 측정
      measureElement(el);
      return;
    }

    const img = new Image();
    // Use proxy to avoid CORS issues
    const proxied = `/api/image-proxy?url=${encodeURIComponent(thumbUrl)}`;
    img.src = proxied;
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth || 9 / 16;
      const height = Math.round(width * ratio);
      el.style.height = `${height}px`;
      // measure after layout has applied
      requestAnimationFrame(() => measureElement(el));
    };
    img.onerror = () => {
      // 실패 시 측정만 호출
      measureElement(el);
    };
  }, [video, measureElement, virtualRow]);

  useEffect(() => {
    // initial 위치 스타일 적용
    const el = rootRef.current;
    if (el && virtualRow) {
      el.style.position = "absolute";
      el.style.top = "0";
      el.style.left = "0";
      el.style.width = "100%";
      el.style.transform = `translateY(${virtualRow.start}px)`;
    }

    // poster 로드 후 높이 계산 및 측정
    computeHeightAndMeasure();

    // resize 시 재계산
    const onResize = () => {
      // remove inline height to recalc width-based height
      if (el) el.style.height = "";
      computeHeightAndMeasure();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [virtualRow, computeHeightAndMeasure]);

  // Intersection Observer로 화면에 보이는지 감지
  useEffect(() => {
    const currentRef = rootRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const vid = videoRef.current;
        if (!entry.isIntersecting && vid) {
          vid.pause();
        } else if (entry.isIntersecting && vid) {
          vid.play().catch(() => {});
        }
      },
      {
        threshold: 0.5,
      }
    );

    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  const handleVideoClick = async (e) => {
    if (!videoRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const clickPosition = x / width;

    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    clickTimerRef.current = setTimeout(() => {
      const clickCount = clickCountRef.current;
      clickCountRef.current = 0;

      if (clickCount === 1) {
        if (clickPosition < 0.5) {
          videoRef.current.currentTime = Math.max(
            0,
            videoRef.current.currentTime - 5
          );
        } else {
          videoRef.current.currentTime = Math.min(
            videoRef.current.duration,
            videoRef.current.currentTime + 5
          );
        }
      } else if (clickCount === 2) {
        const newRate = videoRef.current.playbackRate === 1 ? 2 : 1;
        videoRef.current.playbackRate = newRate;
      } else if (clickCount >= 3) {
        if (!document.fullscreenElement) {
          videoRef.current
            .requestFullscreen()
            .catch((err) => console.error("Fullscreen error:", err));
        } else {
          document.exitFullscreen();
        }
      }
    }, 300);
  };

  return (
    <div ref={rootRef} className="break-inside-avoid bg-white mb-4">
      <div
        className="relative w-full cursor-pointer"
        onClick={handleVideoClick}
      >
        <video
          ref={videoRef}
          className="w-full block"
          poster={video?.thumbs?.url3}
          style={{ display: "block", width: "100%", height: "100%" }}
          playsInline
          loop
          muted
          preload="metadata"
          src={`/api/terabox-stream?fileId=${video?.fs_id}`}
          onLoadedData={() => setIsLoading(false)}
          onError={(e) => {
            console.error("Video playback error:", e);
            setIsLoading(false);
          }}
        >
          Your browser does not support the video tag.
        </video>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="w-12 h-12 text-white" />
          </div>
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

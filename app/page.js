"use client";

import { useState, useEffect, useRef } from "react";
import { useVideoStore } from "@/lib/useVideoStore";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

const Page = () => {
  const videos = useVideoStore((s) => s.videos);
  const setVideos = useVideoStore((s) => s.setVideos);

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
        const allVideos = [...data1, ...data2, ...data3];
        // Shuffle array using Fisher-Yates algorithm
        for (let i = allVideos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allVideos[i], allVideos[j]] = [allVideos[j], allVideos[i]];
        }
        setVideos(allVideos);
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      }
    };

    fetchVideos();
  }, [setVideos]);

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

// Content: tanstack virtual 적용 (fixed-height items to avoid layout thrash)
const Content = ({ videos }) => {
  return (
    <div className="pt-16 sm:px-2 mx-auto">
      <div
        className="w-full mx-auto"
        style={{ height: "calc(100vh - 4rem)", overflowY: "auto" }}
      >
        {videos.map((video, index) => (
          <Item video={video} key={index} />
        ))}
      </div>
    </div>
  );
};

// Item: fixed-height, memoized to avoid re-renders causing flicker
const Item = ({ video }) => {
  //const videoRef = useRef(null);

  return (
    <div className="bg-white mb-4">
      <div className="cursor-pointer">
        <ImageToVideo video={video} />
      </div>
      <div
        className="flex gap-2 p-2 items-start justify-between"
        style={{ alignItems: "flex-end" }}
      >
        <div className="flex items-center gap-2">
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
    </div>
  );
};

const ImageToVideo = ({ video }) => {
  const [toggle, setToggle] = useState(false);

  // 스크롤로 화면에 가까워 졋을때
  // video?.thumbs?.icon 을 video?.thumbs?.url3 으로 변경

  return (
    <div onClick={() => setToggle(!toggle)}>
      {toggle ? (
        <video
          className="w-full"
          poster={video?.thumbs?.url3}
          controls
          autoPlay
          muted
          loop
          src={`/api/terabox-stream?fileId=${video.fs_id}`}
        >
          Your browser does not support the video tag.
        </video>
      ) : (
        <img
          src={video?.thumbs?.icon}
          alt="Image"
          className={`transition-opacity duration-300 w-full`}
        />
      )}
    </div>
  );
};

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const Page2 = () => {
  return (
    <div className="w-screen  h-screen">
      <Header />
      <Content />
      <Bottom />
    </div>
  );
};

export default Page2;

const Header = () => {
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

  return (
    <div
      className={`fixed top-0 w-full h-16 bg-white flex items-center justify-between px-4 transition-transform duration-300 ease-in-out z-50 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="text-2xl font-bold absolute left-1/2 transform -translate-x-1/2">
        Instagram
      </div>
      <div></div>
    </div>
  );
};

const Content = () => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/api/fetch-file-list?folderName=/videos"
        );
        const data = await response.json();
        setVideos(data);
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      }
    };

    fetchVideos();
  }, []);

  return (
    <div className="pt-16">
      {videos.map((video) => (
        <Item key={video.fs_id} video={video} />
      ))}
    </div>
  );
};

const Item = ({ video }) => {
  const [showVideo, setShowVideo] = useState(false);
  const [streamingUrl, setStreamingUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleImageClick = async () => {
    if (showVideo) {
      // 이미 비디오가 보이면 다시 이미지로
      setShowVideo(false);
      return;
    }

    // 프록시 URL 생성 (서버에서 인증 처리)
    if (!streamingUrl) {
      setIsLoading(true);
      try {
        // /api/terabox-stream 프록시를 통해 스트리밍
        // fileId 파라미터를 사용하면 서버에서 자동으로 fresh 링크를 가져오고 쿠키 추가
        const proxyUrl = `/api/terabox-stream?fileId=${video.fs_id}`;
        setStreamingUrl(proxyUrl);
        setShowVideo(true);
      } catch (error) {
        console.error("Error setting up streaming:", error);
        alert("에러가 발생했습니다: " + error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      // URL이 이미 있으면 바로 보여주기
      setShowVideo(true);
    }
  };

  return (
    <div className="border-b pb-4">
      <div
        className="relative w-full cursor-pointer"
        onClick={handleImageClick}
      >
        {!showVideo ? (
          <>
            <img className="w-full" src={video.thumbs.url3} alt="thumbnail" />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="text-white">Loading...</div>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 opacity-0 hover:opacity-100 transition-all">
              <div className="text-white text-4xl drop-shadow-lg">▶</div>
            </div>
          </>
        ) : (
          <video
            className="w-full"
            controls
            autoPlay
            playsInline
            src={streamingUrl}
            onError={(e) => {
              console.error("Video playback error:", e);
              setShowVideo(false);
              setStreamingUrl(null);
              alert("비디오 재생에 실패했습니다.");
            }}
          >
            Your browser does not support the video tag.
          </video>
        )}
      </div>
      <div className="flex flex-col p-2">
        <span className="font-bold">{video.fs_id}</span>
        <span>{video.server_filename}</span>
      </div>
    </div>
  );
};

const Bottom = () => {
  const router = useRouter();

  const handleAddClick = () => {
    router.push("/add");
  };

  return (
    <div className="fixed bottom-0 w-full h-16 bg-white flex items-center justify-center px-4 border-t">
      <button
        onClick={handleAddClick}
        className="w-14 h-14 bg-black rounded-full flex items-center justify-center hover:bg-opacity-70 transition-all shadow-lg"
        aria-label="추가"
      >
        <span className="text-white text-3xl font-light">+</span>
      </button>
    </div>
  );
};

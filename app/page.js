'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

const Page = () => {
  return (
    <div className="w-screen h-screen">
      <Header />
      <Content />
    </div>
  );
};

export default Page;

const Header = () => {
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

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleAddClick = () => {
    router.push('/add');
  };

  return (
    <div
      className={`fixed top-0 w-full h-16 flex items-center justify-between px-4 transition-transform duration-300 ease-in-out z-50 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div></div>
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

const Content = () => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await fetch('/api/fetch-file-list?folderName=/videos');
        const data = await response.json();
        setVideos(data);
      } catch (error) {
        console.error('Failed to fetch videos:', error);
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
  const itemRef = useRef(null);
  const videoRef = useRef(null);

  const loadAndPlayVideo = useCallback(async () => {
    if (streamingUrl) {
      setShowVideo(true);
      return;
    }

    setIsLoading(true);
    try {
      const proxyUrl = `/api/terabox-stream?fileId=${video.fs_id}`;
      setStreamingUrl(proxyUrl);
      setShowVideo(true);
    } catch (error) {
      console.error('Error setting up streaming:', error);
    } finally {
      setIsLoading(false);
    }
  }, [streamingUrl, video.fs_id]);

  // Intersection Observer로 화면에 보이는지 감지
  useEffect(() => {
    const currentRef = itemRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 화면에 보이면 자동 재생
        if (entry.isIntersecting && !showVideo && !streamingUrl) {
          loadAndPlayVideo();
        }

        // 화면에서 벗어나면 비디오 일시정지
        if (!entry.isIntersecting && videoRef.current) {
          videoRef.current.pause();
        } else if (entry.isIntersecting && videoRef.current && showVideo) {
          videoRef.current.play();
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
  }, [showVideo, streamingUrl, loadAndPlayVideo]);

  const handleImageClick = async () => {
    if (showVideo) {
      setShowVideo(false);
      return;
    }
    loadAndPlayVideo();
  };

  return (
    <div ref={itemRef} className="border-b pb-4">
      <div
        className="relative w-full cursor-pointer"
        onClick={handleImageClick}
      >
        {!showVideo ? (
          <>
            <img
              className="w-full block"
              src={video.thumbs.url3}
              alt="thumbnail"
            />
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
            ref={videoRef}
            className="w-full block"
            style={{ aspectRatio: 'auto' }}
            controls
            autoPlay
            playsInline
            loop
            muted
            src={streamingUrl}
            onError={(e) => {
              console.error('Video playback error:', e);
              setShowVideo(false);
              setStreamingUrl(null);
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

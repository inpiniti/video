"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import PostCard from "./components/PostCard";
import PostPreview from "./components/PostPreview";
import { Loader2, Shuffle, Video, Image as ImageIcon } from "lucide-react";

interface Post {
  id: number;
  title: string;
  date: string;
  thumbnail: string;
  url: string;
  imgs?: string[];
  videos?: string[];
  dropboxImgs?: string[];
  dropboxVideos?: string[];
}

export default function Home() {
  // We'll load all posts once, then virtualize rendering with a fixed item height
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showVideos, setShowVideos] = useState(true);
  const [showImages, setShowImages] = useState(true);
  const lastScrollY = useRef(0);
  const hasRestoredScroll = useRef(false);
  const originalPosts = useRef<Post[]>([]);

  // Virtualization state
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(3);
  const [itemHeight, setItemHeight] = useState(384); // px; matches PostCard md:h-96
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );

  const BUFFER_ROWS = 3;

  async function fetchAllPosts() {
    setLoading(true);
    try {
      // Request a very large limit so API returns all items
      const res = await fetch(`/api/posts?page=1&limit=999999`);
      const data = await res.json();
      const fetchedPosts = data.data || [];
      originalPosts.current = fetchedPosts;

      // Shuffle immediately on initial load
      const shuffled = [...fetchedPosts];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setPosts(shuffled);
      setIsShuffled(true);
    } catch (err) {
      console.error("Failed to load posts:", err);
    } finally {
      setLoading(false);
    }
  }

  function shufflePosts() {
    // Always shuffle from original order to ensure randomness
    const shuffled = [...originalPosts.current];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setPosts(shuffled);
    setIsShuffled(true);
    // Scroll to top when shuffling
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const toggleVideoFilter = () => {
    if (showVideos && !showImages) {
      // If images are hidden and we try to hide videos, show images (radio behavior)
      setShowVideos(false);
      setShowImages(true);
    } else if (showVideos && showImages) {
      setShowVideos(false);
    } else {
      setShowVideos(true);
    }
  };

  const toggleImageFilter = () => {
    if (showImages && !showVideos) {
      // If videos are hidden and we try to hide images, show videos (radio behavior)
      setShowImages(false);
      setShowVideos(true);
    } else if (showImages && showVideos) {
      setShowImages(false);
    } else {
      setShowImages(true);
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const hasVideo = (post.videos && post.videos.length > 0) || (post.dropboxVideos && post.dropboxVideos.length > 0);
      const hasImage = (post.imgs && post.imgs.length > 0) || (post.dropboxImgs && post.dropboxImgs.length > 0);

      // If post has both, show if either filter is active
      if (hasVideo && hasImage) return showVideos || showImages;
      // If post has only video, show if video filter is active
      if (hasVideo) return showVideos;
      // If post has only image, show if image filter is active
      if (hasImage) return showImages;

      return false;
    });
  }, [posts, showVideos, showImages]);

  // Handle header visibility on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show header if at top or scrolling up
      if (currentScrollY < 50 || currentScrollY < lastScrollY.current) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        // Hide header if scrolling down and not at top
        setShowHeader(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Save scroll position on scroll
  // IMPORTANT: Ignore scroll resets to 0 that happen during navigation
  useEffect(() => {
    let lastSavedScroll = 0;
    let isNavigating = false;

    const handleScroll = () => {
      if (typeof window !== "undefined") {
        const scrollY = window.scrollY;

        // 네비게이션 중 스크롤이 0으로 떨어지면 무시 (이전 값 유지)
        if (scrollY === 0 && lastSavedScroll > 0 && isNavigating) {
          return;
        }

        // 정상적인 스크롤만 저장
        if (scrollY !== 0 || lastSavedScroll === 0) {
          lastSavedScroll = scrollY;
          sessionStorage.setItem("_gallery_scroll", scrollY.toString());
        }
      };
    };

    // 페이지 떠날 때 isNavigating 플래그 설정
    const handleBeforeUnload = () => {
      isNavigating = true;
    };

    // 페이지 돌아올 때 플래그 제거
    const handlePageShow = () => {
      isNavigating = false;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // Disable browser's default scroll restoration
  useEffect(() => {
    if (typeof window !== "undefined" && window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  // Restore scroll position logic
  useEffect(() => {
    if (filteredPosts.length === 0) return;
    if (hasRestoredScroll.current) return;

    const savedScrollStr = sessionStorage.getItem("_gallery_scroll");
    if (!savedScrollStr) return;

    const savedScroll = parseInt(savedScrollStr, 10);
    if (savedScroll === 0) return;

    const checkAndRestore = () => {
      // Calculate expected total height
      const totalRows = Math.ceil(filteredPosts.length / columns);
      const totalHeight = totalRows * itemHeight;

      // If content is tall enough
      if (totalHeight >= savedScroll) {
        // Attempt to scroll
        window.scrollTo(0, savedScroll);

        // Verify if we reached the target (allow small margin of error)
        if (Math.abs(window.scrollY - savedScroll) < 50) {
          hasRestoredScroll.current = true;
        }
      }
    };

    // 1. Immediate attempt
    checkAndRestore();

    // 2. Observe resize events (content rendering)
    const resizeObserver = new ResizeObserver(() => {
      if (!hasRestoredScroll.current) {
        checkAndRestore();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // 3. Retry mechanism for safety (up to 500ms)
    const intervals = [50, 150, 300, 500];
    const timeouts = intervals.map((delay) =>
      setTimeout(() => {
        if (!hasRestoredScroll.current) {
          checkAndRestore();
        }
      }, delay)
    );

    return () => {
      resizeObserver.disconnect();
      timeouts.forEach(clearTimeout);
    };
  }, [filteredPosts, columns, itemHeight]);

  // Run on mount: load all posts
  useEffect(() => {
    fetchAllPosts();
  }, []);

  // Compute columns / itemHeight based on container width
  useEffect(() => {
    function getColumns(width: number) {
      if (width < 640) return 1;
      if (width < 768) return 2;
      if (width < 1024) return 3;
      if (width < 1280) return 4;
      return 5;
    }

    function getItemHeight(width: number) {
      // Matches PostCard height + 16px gap
      // PostCard: h-[640px] sm:h-[480px] md:h-[400px]
      if (width < 640) return 640 + 16;
      if (width < 768) return 480 + 16;
      return 400 + 16;
    }

    const updateLayout = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setColumns(getColumns(w));
        setItemHeight(getItemHeight(w));
      }
      setViewportHeight(window.innerHeight);
    };

    const onScroll = () => {
      const containerTop = containerRef.current
        ? containerRef.current.getBoundingClientRect().top + window.scrollY
        : 0;
      const currentScroll = Math.max(0, window.scrollY - containerTop);
      setScrollTop(currentScroll);
    };

    updateLayout();

    // Use ResizeObserver for container width changes
    const resizeObserver = new ResizeObserver(updateLayout);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateLayout); // Also listen to window resize for viewport height

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateLayout);
    };
  }, [selectedPostId]); // Re-run when selection changes (might affect layout width)

  const selectedPost = posts.find(p => p.id === selectedPostId);

  return (
    <main className="min-h-screen bg-black text-white flex">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedPostId ? 'md:mr-[40%]' : ''}`}>
        <header
          className={`sticky top-0 z-40 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'
            } bg-black/90 backdrop-blur-sm border-b border-zinc-800/50 px-4 py-4 md:p-8 mb-4 flex justify-between items-center shrink-0`}
        >
          <div>
            <h1 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Gallery
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Collection of {filteredPosts.length} items {isShuffled && '(Shuffled)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleVideoFilter}
              className={`p-2 rounded-lg transition-colors ${showVideos ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title="Toggle Videos"
            >
              <Video size={18} />
            </button>
            <button
              onClick={toggleImageFilter}
              className={`p-2 rounded-lg transition-colors ${showImages ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title="Toggle Images"
            >
              <ImageIcon size={18} />
            </button>
            <button
              onClick={shufflePosts}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white transition-colors"
              title="Shuffle posts"
            >
              <Shuffle size={18} className={isShuffled ? 'text-blue-400' : ''} />
              <span className="hidden sm:inline">Shuffle</span>
            </button>
          </div>
        </header>

        <div className="flex-1 md:p-8 pt-0">
          <div ref={containerRef} className="w-full">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            )}

            {!loading && posts.length === 0 && (
              <div className="text-center py-20 text-zinc-500">
                <p className="text-xl">No posts found.</p>
                <p className="text-sm mt-2">
                  The scraper might still be running or the list is empty.
                </p>
              </div>
            )}

            {!loading &&
              filteredPosts.length > 0 &&
              (() => {
                const totalItems = filteredPosts.length;
                const totalRows = Math.ceil(totalItems / columns);
                const totalHeight = totalRows * itemHeight;

                const startRow = Math.max(
                  0,
                  Math.floor(scrollTop / itemHeight) - BUFFER_ROWS
                );
                const endRow = Math.min(
                  totalRows,
                  Math.ceil((scrollTop + viewportHeight) / itemHeight) + BUFFER_ROWS
                );

                const startIndex = startRow * columns;
                const endIndex = Math.min(totalItems, endRow * columns);

                const visibleItems = filteredPosts.slice(startIndex, endIndex);
                const topOffset = startRow * itemHeight;

                return (
                  <div style={{ height: totalHeight, position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        top: topOffset,
                        left: 0,
                        right: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${columns}, 1fr)`,
                          gap: 16,
                        }}
                      >
                        {visibleItems.map((post) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            onClick={() => setSelectedPostId(post.id)}
                            isSelected={selectedPostId === post.id}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      </div>

      {/* Preview Pane */}
      {selectedPost && (() => {
        const currentIndex = filteredPosts.findIndex(p => p.id === selectedPostId);
        const hasPrevious = currentIndex > 0;
        const hasNext = currentIndex < filteredPosts.length - 1;

        const handleNavigate = (direction: 'prev' | 'next') => {
          if (direction === 'prev' && hasPrevious) {
            setSelectedPostId(filteredPosts[currentIndex - 1].id);
          } else if (direction === 'next' && hasNext) {
            setSelectedPostId(filteredPosts[currentIndex + 1].id);
          }
        };

        return (
          <div className="fixed top-0 right-0 bottom-0 w-full md:w-[40%] md:min-w-[400px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50">
            <PostPreview
              post={selectedPost}
              onClose={() => setSelectedPostId(null)}
              onNavigate={handleNavigate}
              hasPrevious={hasPrevious}
              hasNext={hasNext}
            />
          </div>
        );
      })()}
    </main>
  );
}

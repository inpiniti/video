"use client";

import { useEffect, useState, useRef } from "react";
import { ExternalLink, Calendar, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

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

interface PostPreviewProps {
    post: Post;
    onClose: () => void;
    onNavigate?: (direction: 'prev' | 'next') => void;
    hasPrevious?: boolean;
    hasNext?: boolean;
}

export default function PostPreview({ post, onClose, onNavigate, hasPrevious = false, hasNext = false }: PostPreviewProps) {
    const [localImages, setLocalImages] = useState<string[]>([]);
    const [localVideos, setLocalVideos] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [mediaErrors, setMediaErrors] = useState<Set<number>>(new Set());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Reset state when post changes
    useEffect(() => {
        setLocalImages([]);
        setLocalVideos([]);
        setActiveIndex(0);
        setMediaErrors(new Set());

        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }

        // Handle Images: Prioritize Dropbox, fallback to local API
        if (post.dropboxImgs && post.dropboxImgs.length > 0) {
            setLocalImages(post.dropboxImgs);
        } else if (post.imgs && Array.isArray(post.imgs)) {
            const localImgs = post.imgs.map(
                (_: string, idx: number) =>
                    `/api/media?file=${post.id}_img_${idx + 1}.jpg&type=image`
            );
            setLocalImages(localImgs);
        }

        // Handle Videos: Prioritize Dropbox, fallback to local API
        if (post.dropboxVideos && post.dropboxVideos.length > 0) {
            setLocalVideos(post.dropboxVideos);
        } else if (post.videos && Array.isArray(post.videos)) {
            const localVids = post.videos.map(
                (_: string, idx: number) =>
                    `/api/media?file=${post.id}_video_${idx + 1}.mp4&type=video`
            );
            setLocalVideos(localVids);
        }
    }, [post]);

    type MediaItem = { type: 'video'; src: string; poster?: string } | { type: 'image'; src: string; poster?: undefined };

    const allMedia: MediaItem[] = [
        ...localVideos.map((src, i) => ({ type: 'video' as const, src, poster: i === 0 ? post.thumbnail : undefined })),
        ...localImages.map((src) => ({ type: 'image' as const, src }))
    ];

    const scrollToMedia = (index: number) => {
        if (index < 0 || index >= allMedia.length) return;
        setActiveIndex(index);
        const container = scrollContainerRef.current;
        if (container) {
            const element = container.children[index] as HTMLElement;
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    const handleMediaError = (index: number, src: string) => {
        console.error(`Failed to load media at index ${index}: ${src}`);
        setMediaErrors(prev => new Set(prev).add(index));
    };

    return (
        <div className="h-full flex flex-col bg-zinc-900 border-l border-zinc-800">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-start shrink-0">
                <div className="flex-1 min-w-0 mr-4">
                    <h2 className="text-xl font-bold text-white line-clamp-2 mb-2">{post.title}</h2>
                    <div className="flex items-center gap-4 text-zinc-400 text-xs">
                        <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{post.date}</span>
                        </div>
                        <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <ExternalLink size={12} />
                            Source
                        </a>
                    </div>
                </div>

                {/* Navigation and Close Buttons */}
                <div className="flex items-center gap-2">
                    {onNavigate && (
                        <>
                            <button
                                onClick={() => onNavigate('prev')}
                                disabled={!hasPrevious}
                                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Previous Post"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => onNavigate('next')}
                                disabled={!hasNext}
                                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Next Post"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content Area - Vertical Carousel */}
            <div className="flex-1 relative overflow-hidden bg-black">
                {allMedia.length > 0 ? (
                    <>
                        <div
                            ref={scrollContainerRef}
                            className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
                            onScroll={(e) => {
                                // Optional: Update active index based on scroll position
                            }}
                        >
                            {allMedia.map((media, idx) => (
                                <div
                                    key={`${media.type}-${idx}`}
                                    className="w-full h-full snap-center flex items-center justify-center"
                                >
                                    {mediaErrors.has(idx) ? (
                                        <div className="text-zinc-500 text-center p-4">
                                            <p>Failed to load {media.type}</p>
                                            <p className="text-xs mt-2">Try refreshing the page</p>
                                        </div>
                                    ) : media.type === 'video' ? (
                                        <video
                                            controls
                                            className="w-full h-full object-contain bg-black"
                                            poster={media.poster}
                                            preload="metadata"
                                            onError={() => handleMediaError(idx, media.src)}
                                        >
                                            <source src={media.src} type="video/mp4" />
                                            Your browser does not support the video tag.
                                        </video>
                                    ) : (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <img
                                                src={media.src}
                                                alt={`Content ${idx}`}
                                                className="max-w-full max-h-full object-contain"
                                                onError={() => handleMediaError(idx, media.src)}
                                            />
                                            <a
                                                href={media.src}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="absolute bottom-4 right-4 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                                                title="Open Original"
                                            >
                                                <ExternalLink size={20} />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Navigation Controls */}
                        {allMedia.length > 1 && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
                                <button
                                    onClick={() => scrollToMedia(activeIndex - 1)}
                                    disabled={activeIndex === 0}
                                    className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm transition-all"
                                >
                                    <ChevronUp size={24} />
                                </button>
                                <button
                                    onClick={() => scrollToMedia(activeIndex + 1)}
                                    disabled={activeIndex === allMedia.length - 1}
                                    className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm transition-all"
                                >
                                    <ChevronDown size={24} />
                                </button>
                            </div>
                        )}

                        {/* Page Indicator */}
                        {allMedia.length > 1 && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 px-3 py-1 rounded-full text-white text-xs backdrop-blur-sm">
                                {activeIndex + 1} / {allMedia.length}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500">
                        No media available
                    </div>
                )}
            </div>
        </div>
    );
}

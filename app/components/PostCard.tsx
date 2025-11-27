"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Image as ImageIcon, Video } from "lucide-react";

interface PostCardProps {
  post: {
    id: number;
    title: string;
    date: string;
    thumbnail: string;
    url: string;
    imgs?: string[];
    videos?: string[];
    dropboxImgs?: string[];
    dropboxVideos?: string[];
  };
  onClick?: () => void;
  isSelected?: boolean;
}

export default function PostCard({ post, onClick, isSelected }: PostCardProps) {
  const hasVideo = post.videos && post.videos.length > 0;
  const videoCount = post.videos?.length || 0;
  const imageCount = post.imgs?.length || 0;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`group cursor-pointer ${isSelected ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}
      onClick={onClick}
    >
      <div className="block">

        {/* Fixed-height card to enable reliable virtual scrolling */}
        <div className="bg-zinc-900 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-zinc-800 hover:border-zinc-600 hover:-translate-y-1 h-[640px] sm:h-[480px] md:h-[400px] flex flex-col">
          {/* image area: fixed portion (about 2/3) */}
          <div className="relative flex-1 w-full">
            {post.thumbnail ? (
              <>
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
                )}
                <Image
                  src={post.thumbnail}
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover"
                  onLoadingComplete={() => setImgLoaded(true)}
                  unoptimized
                />
              </>
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600">
                <ImageIcon size={48} />
              </div>
            )}

            {/* Play button overlay for videos */}
            {hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center group-hover:bg-black/30 transition-colors duration-300">
                <div className="bg-black/60 rounded-full p-4 group-hover:scale-110 group-hover:bg-black/50 transition-all duration-300 shadow-lg">
                  <Video size={32} className="text-white fill-white" />
                </div>
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-2 right-2 flex gap-1">
              {videoCount > 0 && (
                <div className="bg-black/70 px-2 py-1 rounded-full text-white backdrop-blur-sm flex items-center gap-1 text-xs">
                  <Video size={14} />
                  <span>{videoCount}</span>
                </div>
              )}
              {imageCount > 0 && (
                <div className="bg-black/70 px-2 py-1 rounded-full text-white backdrop-blur-sm flex items-center gap-1 text-xs">
                  <ImageIcon size={14} />
                  <span>{imageCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* meta area: fixed portion (about 1/3) */}
          <div className="p-4 sharink-0">
            <h3 className="text-white font-medium text-sm line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors">
              {post.title}
            </h3>
            <div className="flex items-center text-zinc-500 text-xs gap-1">
              <Calendar size={12} />
              <span>{post.date}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

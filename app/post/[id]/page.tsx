"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Calendar, Download, ChevronLeft, ChevronRight } from "lucide-react";

interface Post {
  id: number;
  title: string;
  date: string;
  thumbnail: string;
  url: string;
  imgs?: string[];
  videos?: string[];
  prevId?: number | null;
  nextId?: number | null;
}

export default function PostDetail() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [localVideos, setLocalVideos] = useState<string[]>([]);

  // 상세 페이지 진입 시 스크롤 리셋을 방지
  useEffect(() => {
    // 사실은 가장 중요한 것: sessionStorage에서 값을 제거하지 않기
    // 이미 저장된 스크롤 값을 보호
    const savedScroll = sessionStorage.getItem("_gallery_scroll");

    return () => {
      // cleanup 시에도 sessionStorage 값을 건드리지 않음
    };
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setPost(data);

          // Convert to local file URLs
          // 다운로드된 파일: {id}_img_{idx}.jpg, {id}_video_{idx}.mp4
          if (data.imgs && Array.isArray(data.imgs)) {
            const localImgs = data.imgs.map(
              (_: string, idx: number) =>
                `/api/media?file=${data.id}_img_${idx + 1}.jpg&type=image`
            );
            setLocalImages(localImgs);
          }
          if (data.videos && Array.isArray(data.videos)) {
            const localVids = data.videos.map(
              (_: string, idx: number) =>
                `/api/media?file=${data.id}_video_${idx + 1}.mp4&type=video`
            );
            setLocalVideos(localVids);
          }
        } else {
          console.error("Post not found");
        }
      } catch (error) {
        console.error("Error fetching post:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchPost();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Post not found</h1>
        <Link href="/" className="text-blue-400 hover:underline">
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              // 중요: Back 버튼 클릭 시 최근 저장된 스크롤 위치를 유지하도록 설정
              // (sessionStorage는 뒤로가기할 때 유지되므로 값을 건드리지 않음)
              router.back();
            }}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            Back
          </button>

          <div className="flex gap-2">
            {post.prevId && (
              <Link
                href={`/post/${post.prevId}`}
                className="flex items-center gap-1 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors border border-zinc-800"
              >
                <ChevronLeft size={20} />
                Prev
              </Link>
            )}
            {post.nextId && (
              <Link
                href={`/post/${post.nextId}`}
                className="flex items-center gap-1 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors border border-zinc-800"
              >
                Next
                <ChevronRight size={20} />
              </Link>
            )}
          </div>
        </div>

        <header className="mb-8 border-b border-zinc-800 pb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-zinc-400 text-sm">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>{post.date}</span>
            </div>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink size={16} />
              Original Source
            </a>
          </div>
        </header>

        <div className="space-y-16">
          {/* Videos Section */}
          {post.videos && post.videos.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                Videos{" "}
                <span className="text-zinc-500 text-lg font-normal">
                  ({post.videos.length})
                </span>
              </h2>
              <div className="flex flex-col gap-12">
                {localVideos.map((localVideo, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl"
                  >
                    <div className="relative w-full aspect-video bg-black">
                      <video
                        controls
                        className="absolute inset-0 w-full h-full"
                        poster={idx === 0 ? post.thumbnail : undefined}
                      >
                        <source src={localVideo} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                    <div className="p-4 flex justify-between items-center bg-zinc-900">
                      <span className="text-zinc-400 text-sm">
                        Video {idx + 1}
                      </span>
                      <a
                        href={localVideo}
                        download
                        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-zinc-800"
                      >
                        <Download size={20} />
                        <span className="text-sm font-medium">Download</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Images Section */}
          {post.imgs && post.imgs.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                Images{" "}
                <span className="text-zinc-500 text-lg font-normal">
                  ({post.imgs.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {localImages.map((localImg, idx) => (
                  <div
                    key={idx}
                    className="group relative bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-lg"
                  >
                    <img
                      src={localImg}
                      alt={`Image ${idx + 1}`}
                      className="w-full h-auto object-cover hover:scale-[1.02] transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-end p-4 opacity-0 group-hover:opacity-100">
                      <a
                        href={localImg}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-black/60 backdrop-blur-md p-3 rounded-full text-white hover:bg-black/80 transition-all transform translate-y-2 group-hover:translate-y-0"
                      >
                        <ExternalLink size={24} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!post.videos?.length && !post.imgs?.length && (
            <div className="text-center py-20 text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800 border-dashed">
              No media found for this post.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

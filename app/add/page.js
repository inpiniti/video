"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase, hasSupabase } from "@/lib/supabaseClient";

const AddPage = () => {
  return (
    <div className="w-screen h-screen">
      <Header />
      <Content />
    </div>
  );
};

export default AddPage;

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

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleBack = () => {
    router.back();
  };

  return (
    <div
      className={`fixed top-0 w-full h-16 bg-white flex items-center justify-between px-4 transition-transform duration-300 ease-in-out z-50 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <button
        onClick={handleBack}
        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="뒤로 가기"
      >
        <ArrowLeft size={24} className="text-gray-700" />
      </button>
      <div className="text-2xl font-bold absolute left-1/2 transform -translate-x-1/2">
        추가
      </div>
      <div></div>
    </div>
  );
};

const Content = () => {
  const [link, setLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [videos, setVideos] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Fetch videos from Supabase
  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      if (!hasSupabase() || !supabase) {
        setVideos([]);
        return;
      }
      
      const { data, error } = await supabase
        .from("videos")
        .select("id,title,date,url,actor,thumbnail")
        .order("date", { ascending: false })
        .limit(1000);

      if (error) throw error;
      
      const mapped = (data || []).map((r) => {
        if (!r || typeof r !== "object") return null;
        const url = typeof r.url === "string" ? r.url : undefined;
        if (!url) return null;
        // Filter out image links (img.co)
        if (url.includes("img.co")) return null;
        return {
          id: typeof r.id === "number" ? r.id : 
              typeof r.id === "string" ? parseInt(r.id, 10) || undefined : undefined,
          title: typeof r.title === "string" ? r.title : undefined,
          date: typeof r.date === "string" ? r.date : undefined,
          url,
          actor: typeof r.actor === "string" ? r.actor : undefined,
          thumbnail: typeof r.thumbnail === "string" ? r.thumbnail : undefined,
        };
      }).filter(Boolean);
      
      setVideos(mapped);
    } catch (error) {
      console.error("Failed to fetch videos:", error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!link.trim()) {
      alert("링크를 입력해주세요.");
      return;
    }

    // Validate URL
    try {
      new URL(link);
    } catch {
      alert("올바른 URL 형식이 아닙니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/simple-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "업로드 요청 실패");
      }

      // Show success message
      alert(data.message || "업로드 중입니다...");
      setLink("");
      // Refresh video list
      fetchVideos();
    } catch (error) {
      console.error("Upload error:", error);
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setSelectedFile(file);
    } else {
      alert("동영상 파일만 업로드 가능합니다.");
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert("파일을 선택해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/simple-upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "업로드 요청 실패");
      }

      // Show success message
      alert(data.message || "업로드 중입니다...");
      setSelectedFile(null);
      // Refresh video list
      fetchVideos();
    } catch (error) {
      console.error("Upload error:", error);
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSelected = async () => {
    if (selectedVideos.size === 0) {
      alert("등록할 비디오를 선택해주세요.");
      return;
    }

    const selectedVideoList = videos.filter((v) => selectedVideos.has(v.id));
    
    if (!confirm(`선택한 ${selectedVideoList.length}개의 비디오를 등록하시겠습니까?`)) {
      return;
    }

    setIsRegistering(true);
    let successCount = 0;
    let failCount = 0;

    for (const video of selectedVideoList) {
      try {
        const response = await fetch("/api/simple-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: video.url }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "업로드 요청 실패");
        }

        successCount++;
        console.log(`등록 성공: ${video.url}`);
      } catch (error) {
        console.error(`등록 실패 (${video.url}):`, error);
        failCount++;
      }
    }

    setIsRegistering(false);
    alert(`등록 완료\n성공: ${successCount}개\n실패: ${failCount}개`);
    
    // Clear selection and refresh
    setSelectedVideos(new Set());
    fetchVideos();
  };

  return (
    <div className="pt-16 pb-16 min-h-screen bg-gray-50">
      <div className="p-6 max-w-2xl mx-auto">
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="file">파일</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-6 space-y-6">
            <div>
              <label className="block text-gray-500 text-sm mb-2">
                동영상 URL
              </label>
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mb-4"
                disabled={isSubmitting}
              />
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="w-full py-3 bg-black text-white rounded-lg hover:bg-opacity-80 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "등록 중..." : "등록"}
              </button>
              <p className="text-sm text-gray-500 mt-4 text-center">
                등록 후 다운로드, 압축, 업로드가 백그라운드에서 진행됩니다.
              </p>
            </div>

            {/* Video List Table */}
            <div className="border rounded-lg bg-white">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold">비디오 목록</h3>
                <button
                  onClick={handleRegisterSelected}
                  disabled={isRegistering || selectedVideos.size === 0}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-opacity-80 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isRegistering ? "등록 중..." : `선택 항목 등록 (${selectedVideos.size})`}
                </button>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">
                    로딩 중...
                  </div>
                ) : videos.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    등록된 비디오가 없습니다.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedVideos.size === videos.length && videos.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedVideos(new Set(videos.map((v) => v.id)));
                              } else {
                                setSelectedVideos(new Set());
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="w-40">날짜</TableHead>
                        <TableHead>URL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {videos.map((video) => (
                        <TableRow key={video.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedVideos.has(video.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedVideos);
                                if (checked) {
                                  newSelected.add(video.id);
                                } else {
                                  newSelected.delete(video.id);
                                }
                                setSelectedVideos(newSelected);
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {video.date ? new Date(video.date).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            }).replace(/\. /g, '.').replace(/\.$/, '') : '-'}
                          </TableCell>
                          <TableCell className="text-sm truncate max-w-md">
                            {video.url}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="file" className="mt-6">
            <label className="block text-gray-500 text-sm mb-2">
              동영상 파일
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-black bg-gray-100"
                  : selectedFile
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="video/*"
                className="hidden"
                id="video-file"
                onChange={handleFileChange}
              />
              <label
                htmlFor="video-file"
                className="cursor-pointer text-gray-600 hover:text-black transition-colors block"
              >
                {selectedFile ? (
                  <>
                    <div className="mb-2">✅</div>
                    <div className="font-medium text-green-600">
                      파일 선택됨
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-2">📁</div>
                    <div className="font-medium">파일 선택</div>
                    <div className="text-sm text-gray-500 mt-1">
                      또는 드래그 앤 드롭
                    </div>
                  </>
                )}
              </label>
            </div>

            <button
              onClick={handleFileUpload}
              disabled={isSubmitting || !selectedFile}
              className="w-full mt-4 py-3 bg-black text-white rounded-lg hover:bg-opacity-80 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>

            <p className="text-sm text-gray-500 mt-4 text-center">
              등록 후 압축, 업로드가 백그라운드에서 진행됩니다.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

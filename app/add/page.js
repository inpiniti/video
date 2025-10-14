"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const router = useRouter();
  const [link, setLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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
    } catch (error) {
      console.error("Upload error:", error);
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-16 pb-16 min-h-screen bg-gray-50">
      <div className="p-6 max-w-2xl mx-auto">
        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="file">파일</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-6">
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

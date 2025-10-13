"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const AddPage = () => {
  return (
    <div className="w-screen h-screen">
      <Header />
      <Content />
      <Bottom />
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

  const handleSave = () => {
    if (!link.trim()) {
      alert("링크를 입력해주세요.");
      return;
    }
    // TODO: 링크 저장 로직
    console.log("Saving link:", link);
    alert("저장되었습니다!");
    setLink("");
  };

  return (
    <div className="pt-16 pb-16 min-h-screen bg-gray-50">
      <div className="p-6 max-w-2xl mx-auto">
        <label className="block text-gray-500 text-sm mb-2">링크</label>
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="링크를 입력하세요"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mb-4"
        />
        <button
          onClick={handleSave}
          className="w-full py-3 bg-black text-white rounded-lg hover:bg-opacity-80 transition-all font-medium"
        >
          저장
        </button>
      </div>
    </div>
  );
};

const Bottom = () => {
  return (
    <div className="fixed bottom-0 w-full h-16 bg-white flex items-center justify-center px-4 border-t">
      <div className="text-gray-500">Bottom Bar</div>
    </div>
  );
};

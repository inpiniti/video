"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
        className="text-2xl hover:opacity-70 transition-opacity"
        aria-label="뒤로 가기"
      >
        ←
      </button>
      <div className="text-2xl font-bold absolute left-1/2 transform -translate-x-1/2">
        추가
      </div>
      <div></div>
    </div>
  );
};

const Content = () => {
  return (
    <div className="pt-16 pb-16 min-h-screen bg-gray-50">
      <div className="p-4">
        <p className="text-gray-600">여기에 콘텐츠를 추가하세요.</p>
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

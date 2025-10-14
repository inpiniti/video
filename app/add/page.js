'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

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

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  const handleBack = () => {
    router.back();
  };

  return (
    <div
      className={`fixed top-0 w-full h-16 bg-white flex items-center justify-between px-4 transition-transform duration-300 ease-in-out z-50 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
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
  const [link, setLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!link.trim()) {
      alert('링크를 입력해주세요.');
      return;
    }

    // Validate URL
    try {
      new URL(link);
    } catch {
      alert('올바른 URL 형식이 아닙니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/simple-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '업로드 요청 실패');
      }

      // Show success message
      alert(data.message || '업로드 중입니다...');

      // Navigate back to main page
      router.push('/');
    } catch (error) {
      console.error('Upload error:', error);
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-16 pb-16 min-h-screen bg-gray-50">
      <div className="p-6 max-w-2xl mx-auto">
        <label className="block text-gray-500 text-sm mb-2">동영상 URL</label>
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
          {isSubmitting ? '등록 중...' : '등록'}
        </button>
        <p className="text-sm text-gray-500 mt-4 text-center">
          등록 후 다운로드, 압축, 업로드가 백그라운드에서 진행됩니다.
        </p>
      </div>
    </div>
  );
};

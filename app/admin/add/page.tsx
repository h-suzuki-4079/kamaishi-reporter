'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabaseClient';

export default function AdminAddPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    reward: '',
    description: '',
  });
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReferenceImage(file);
      
      // プレビュー用のURLを作成
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setReferenceImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let referenceImageUrl: string | null = null;

      // 画像が選択されている場合、Supabase Storageにアップロード
      if (referenceImage) {
        const fileExt = referenceImage.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `reference_images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, referenceImage, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          setError('画像のアップロードに失敗しました。もう一度お試しください。');
          setIsSubmitting(false);
          return;
        }

        // アップロードした画像の公開URLを取得
        const { data: urlData } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);

        referenceImageUrl = urlData.publicUrl;
      }

      // 案件データをデータベースに保存
      const { data, error: insertError } = await supabase
        .from('jobs')
        .insert([
          {
            title: formData.title,
            company: formData.company,
            location: formData.location,
            reward: formData.reward,
            description: formData.description,
            reference_image: referenceImageUrl,
            status: 'open',
          },
        ])
        .select();

      if (insertError) {
        console.error('Error inserting job:', insertError);
        setError('案件の登録に失敗しました。もう一度お試しください。');
        setIsSubmitting(false);
        return;
      }

      // 成功時は一覧ページにリダイレクト
      router.push('/?created=true');
    } catch (err) {
      console.error('Error:', err);
      setError('予期しないエラーが発生しました。');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center text-navy-600 hover:text-navy-700 mb-6"
        >
          ← 一覧に戻る
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            新規案件を登録
          </h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                placeholder="例: 求人用写真の撮影"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                企業名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                placeholder="例: 釜石水産 株式会社"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                場所 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                placeholder="例: 釜石市大町"
              />
            </div>

            <div>
              <label htmlFor="reward" className="block text-sm font-medium text-gray-700 mb-2">
                報酬 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="reward"
                name="reward"
                value={formData.reward}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                placeholder="例: 5000"
              />
              <p className="mt-1 text-sm text-gray-500">数値のみ入力してください（例: 5000）</p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                指示内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                required
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent resize-none"
                placeholder="例: 社長の笑顔、工場の外観、作業風景を撮影してください。"
              />
            </div>

            <div>
              <label htmlFor="reference_image" className="block text-sm font-medium text-gray-700 mb-2">
                見本画像（任意）
              </label>
              <input
                type="file"
                id="reference_image"
                name="reference_image"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-navy-600 file:text-white
                  hover:file:bg-navy-700
                  file:cursor-pointer"
              />
              {imagePreview && (
                <div className="mt-4 relative">
                  <img
                    src={imagePreview}
                    alt="プレビュー"
                    className="w-full max-w-md h-auto rounded-lg border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    画像を削除
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-4 px-6 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '登録中...' : '登録する'}
              </button>
              <Link
                href="/"
                className="flex-1 py-4 px-6 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-lg text-center"
              >
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}


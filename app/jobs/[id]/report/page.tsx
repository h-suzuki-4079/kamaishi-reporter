'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabaseClient';
import { Job } from '@/lib/types';

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const [workerName, setWorkerName] = useState('');
  const [photo1, setPhoto1] = useState<File | null>(null);
  const [photo2, setPhoto2] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchJob();
    }
  }, [jobId]);

  async function fetchJob() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', parseInt(jobId))
        .single();

      if (error) {
        console.error('Error fetching job:', error.message, error.details, error.hint);
        return;
      }

      if (data) {
        setJob(data);
      }
    } catch (error: any) {
      console.error('Error fetching job:', error?.message, error?.details, error?.hint);
    } finally {
      setLoading(false);
    }
  }

  const handlePhoto1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto1(e.target.files[0]);
    }
  };

  const handlePhoto2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto2(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 写真が少なくとも1枚は必要
    if (!photo1 && !photo2) {
      alert('少なくとも1枚の写真をアップロードしてください。');
      return;
    }

    setIsSubmitting(true);

    try {
      let photo1Url: string | null = null;
      let photo2Url: string | null = null;

      // 写真1をアップロード
      if (photo1) {
        const fileExt = photo1.name.split('.').pop();
        const fileName = `report_${jobId}_${Date.now()}_1_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `reports/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, photo1, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading photo1:', uploadError.message, uploadError);
          alert('写真1のアップロードに失敗しました。もう一度お試しください。');
          setIsSubmitting(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);

        photo1Url = urlData.publicUrl;
      }

      // 写真2をアップロード
      if (photo2) {
        const fileExt = photo2.name.split('.').pop();
        const fileName = `report_${jobId}_${Date.now()}_2_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `reports/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filePath, photo2, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading photo2:', uploadError.message, uploadError);
          alert('写真2のアップロードに失敗しました。もう一度お試しください。');
          setIsSubmitting(false);
          return;
        }

        const { data: urlData } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);

        photo2Url = urlData.publicUrl;
      }

      // reportsテーブルにINSERT
      const { error: reportError } = await supabase
        .from('reports')
        .insert([
          {
            job_id: Number(params.id),
            photo_url_1: photo1Url,
            photo_url_2: photo2Url,
            report_text: notes || null,
            worker_name: workerName.trim(),
          },
        ]);

      if (reportError) {
        // 詳細なエラーログを出力
        console.error('[reports insert error]', {
          message: reportError.message,
          details: reportError.details,
          code: reportError.code,
          hint: reportError.hint,
          error: reportError,
        });
        
        // 開発環境では詳細なエラーを表示
        const errorMessage = process.env.NODE_ENV === 'development'
          ? `報告の送信に失敗しました: ${reportError.message}${reportError.details ? ` (${reportError.details})` : ''}${reportError.code ? ` [${reportError.code}]` : ''}`
          : '報告の送信に失敗しました。もう一度お試しください。';
        
        alert(errorMessage);
        setIsSubmitting(false);
        return;
      }

      // jobsテーブルのstatusを'review'に更新
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: 'review' })
        .eq('id', Number(params.id));

      if (updateError) {
        // 詳細なエラーログを出力
        console.error('[jobs update error]', {
          message: updateError.message,
          details: updateError.details,
          code: updateError.code,
          hint: updateError.hint,
          error: updateError,
        });
        
        // 開発環境では詳細なエラーを表示
        const errorMessage = process.env.NODE_ENV === 'development'
          ? `案件のステータス更新に失敗しました: ${updateError.message}${updateError.details ? ` (${updateError.details})` : ''}${updateError.code ? ` [${updateError.code}]` : ''}`
          : '案件のステータス更新に失敗しました。';
        
        alert(errorMessage);
        setIsSubmitting(false);
        return;
      }

      // 成功時はトップページへリダイレクト
      router.push('/?submitted=true');
    } catch (err: any) {
      // 予期しないエラーの詳細ログ
      console.error('[reports unexpected error]', {
        message: err?.message,
        details: err?.details,
        code: err?.code,
        hint: err?.hint,
        error: err,
      });
      
      // 開発環境では詳細なエラーを表示
      const errorMessage = process.env.NODE_ENV === 'development'
        ? `予期しないエラーが発生しました: ${err?.message || String(err)}`
        : '予期しないエラーが発生しました。';
      
      alert(errorMessage);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-center text-gray-500">案件が見つかりませんでした。</p>
          <Link href="/" className="block text-center text-navy-600 hover:text-navy-700 mt-4">
            一覧に戻る
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Link
          href={`/jobs/${jobId}`}
          className="inline-flex items-center text-navy-600 hover:text-navy-700 mb-6"
        >
          ← 詳細に戻る
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {job.title}
          </h1>
          <p className="text-gray-600 text-sm">
            {job.company} - {job.location}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            報告フォーム
          </h2>

          <div className="mb-6">
            <label htmlFor="workerName" className="block text-sm font-medium text-gray-700 mb-2">
              お名前（またはID） <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="workerName"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="例: 田中太郎"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              写真1
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto1Change}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-3 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-navy-600 file:text-white
                hover:file:bg-navy-700
                file:cursor-pointer"
            />
            {photo1 && (
              <p className="mt-2 text-sm text-gray-600">
                選択済み: {photo1.name}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              写真2
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto2Change}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-3 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-medium
                file:bg-navy-600 file:text-white
                hover:file:bg-navy-700
                file:cursor-pointer"
            />
            {photo2 && (
              <p className="mt-2 text-sm text-gray-600">
                選択済み: {photo2.name}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              取材メモ
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-transparent resize-none"
              placeholder="取材時のメモや気づいた点を記入してください..."
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '送信中...' : '報告を送信する'}
          </button>
        </form>
      </main>
    </div>
  );
}

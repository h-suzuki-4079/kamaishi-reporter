'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabaseClient';
import { Job, Report } from '@/lib/types';
import { formatReward } from '@/lib/types';

export default function AdminReportPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<Job | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      fetchData();
    }
  }, [jobId]);

  async function fetchData() {
    try {
      // 案件情報を取得
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', parseInt(jobId))
        .single();

      if (jobError) {
        console.error('Error fetching job:', jobError);
        setError('案件情報の取得に失敗しました。');
        setLoading(false);
        return;
      }

      if (jobData) {
        setJob(jobData);
      }

      // 報告情報を取得
      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*')
        .eq('job_id', parseInt(jobId))
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (reportError) {
        console.error('Error fetching report:', reportError);
        setError('報告情報の取得に失敗しました。');
        setLoading(false);
        return;
      }

      if (reportData) {
        setReport(reportData);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('予期しないエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async () => {
    if (!confirm('この報告を承認して検収完了としますか？')) {
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: 'completed' })
        .eq('id', parseInt(jobId));

      if (updateError) {
        console.error('Error updating job status:', updateError);
        setError('ステータスの更新に失敗しました。');
        setIsApproving(false);
        return;
      }

      // 成功時はトップページへリダイレクト
      router.push('/?approved=true');
    } catch (err) {
      console.error('Error:', err);
      setError('予期しないエラーが発生しました。');
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    // window.promptで差し戻し理由を入力
    const feedback = window.prompt('差し戻しの理由を入力してください');
    
    // キャンセルを押した場合（null）または空文字の場合は何もしない
    if (feedback === null || feedback.trim() === '') {
      return;
    }

    setIsRejecting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          status: 'assigned',
          feedback: feedback.trim()
        })
        .eq('id', parseInt(jobId));

      if (updateError) {
        console.error('Error updating job status:', updateError);
        setError('ステータスの更新に失敗しました。');
        setIsRejecting(false);
        return;
      }

      // 成功時はトップページへリダイレクト
      router.push('/?rejected=true');
    } catch (err) {
      console.error('Error:', err);
      setError('予期しないエラーが発生しました。');
      setIsRejecting(false);
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

  if (error && (!job || !report)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
          <Link href="/" className="inline-flex items-center text-navy-600 hover:text-navy-700">
            ← 一覧に戻る
          </Link>
        </main>
      </div>
    );
  }

  if (!job || !report) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-center text-gray-500">案件または報告が見つかりませんでした。</p>
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
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center text-navy-600 hover:text-navy-700 mb-6"
        >
          ← 一覧に戻る
        </Link>

        {/* 案件情報 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {job.title}
          </h1>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">企業名</p>
              <p className="text-gray-900 font-medium">{job.company}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">場所</p>
              <p className="text-gray-900 font-medium">{job.location}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">報酬</p>
              <p className="text-gray-900 font-medium text-xl">{formatReward(job.reward)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">ステータス</p>
              <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                確認中
              </span>
            </div>
          </div>
        </div>

        {/* 報告内容 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">報告内容</h2>

          {/* 写真1 */}
          {report.photo_url_1 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">写真1</h3>
              <div className="rounded-lg overflow-hidden border border-gray-300">
                <img
                  src={report.photo_url_1}
                  alt="報告写真1"
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}

          {/* 写真2 */}
          {report.photo_url_2 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">写真2</h3>
              <div className="rounded-lg overflow-hidden border border-gray-300">
                <img
                  src={report.photo_url_2}
                  alt="報告写真2"
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}

          {/* 取材メモ */}
          {report.report_text && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">取材メモ</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700 whitespace-pre-line">{report.report_text}</p>
              </div>
            </div>
          )}

          {!report.photo_url_1 && !report.photo_url_2 && !report.report_text && (
            <p className="text-gray-500 text-center py-8">報告内容がありません。</p>
          )}
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 承認・差し戻しボタン */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex gap-4">
            <button
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="flex-1 py-4 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving ? '承認中...' : '承認する（検収完了）'}
            </button>
            <button
              onClick={handleReject}
              disabled={isApproving || isRejecting}
              className="flex-1 py-4 px-6 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRejecting ? '処理中...' : '修正を依頼する（差し戻し）'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}


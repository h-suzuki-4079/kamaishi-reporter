'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { supabase } from '@/lib/supabaseClient';
import { Job } from '@/lib/types';
import { formatReward } from '@/lib/types';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdminMode } = useAdminMode();
  const jobId = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMyJob, setIsMyJob] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchJob();
      // localStorageをチェックして自分の案件かどうか確認
      const myJobs = JSON.parse(localStorage.getItem('my_jobs') || '[]');
      setIsMyJob(myJobs.includes(parseInt(jobId)));
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
        console.error('Error fetching job:', error);
        return;
      }

      if (data) {
        setJob(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

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
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center text-navy-600 hover:text-navy-700 mb-6"
        >
          ← 一覧に戻る
        </Link>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {job.title}
          </h1>
          
          {/* 差し戻し理由の表示（ワーカー向け） */}
          {job.status === 'assigned' && job.feedback && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                修正依頼が届いています
              </h3>
              <p className="text-red-700 whitespace-pre-line">
                {job.feedback}
              </p>
            </div>
          )}
          
          <div className="mb-6">
            <p className="text-gray-600 mb-2">
              <span className="font-semibold">企業名:</span> {job.company}
            </p>
            <p className="text-gray-600 mb-2">
              <span className="font-semibold">場所:</span> {job.location}
            </p>
            <p className="text-3xl font-bold text-navy-600 mb-4">
              {formatReward(job.reward)}
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              指示内容
            </h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </div>

          {job.reference_image && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                見本画像
              </h2>
              <div className="rounded-lg overflow-hidden border border-gray-300">
                <img
                  src={job.reference_image}
                  alt="見本画像"
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              場所
            </h2>
            <div className="bg-gray-100 rounded-lg p-8 text-center text-gray-500">
              <p className="mb-2">🗺️ マップ（プレースホルダー）</p>
              <p className="text-sm">{job.location}</p>
            </div>
          </div>
        </div>

        {/* ステータスに応じたボタン表示 */}
        {job.status === 'open' && (
          <button
            onClick={async () => {
              setIsProcessing(true);
              try {
                // Supabaseでstatusを'assigned'に更新
                const { error: updateError } = await supabase
                  .from('jobs')
                  .update({ status: 'assigned' })
                  .eq('id', job.id);

                if (updateError) {
                  console.error('Error updating job status:', updateError);
                  alert('案件の受注に失敗しました。もう一度お試しください。');
                  setIsProcessing(false);
                  return;
                }

                // 更新成功後にlocalStorageに保存
                const myJobs = JSON.parse(localStorage.getItem('my_jobs') || '[]');
                if (!myJobs.includes(job.id)) {
                  myJobs.push(job.id);
                  localStorage.setItem('my_jobs', JSON.stringify(myJobs));
                }
                
                // 報告フォームへ遷移
                router.push(`/jobs/${job.id}/report`);
              } catch (err) {
                console.error('Error:', err);
                alert('予期しないエラーが発生しました。');
                setIsProcessing(false);
              }
            }}
            disabled={isProcessing}
            className="block w-full text-center py-4 px-6 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? '処理中...' : 'この仕事を受ける（着手）'}
          </button>
        )}

        {job.status === 'assigned' && (
          <>
            {isAdminMode ? (
              <button
                disabled
                className="block w-full text-center py-4 px-6 bg-gray-400 text-white rounded-lg cursor-not-allowed font-medium text-lg"
              >
                現在、ワーカーが作業中です
              </button>
            ) : (
              <>
                {isMyJob ? (
                  <Link
                    href={`/jobs/${job.id}/report`}
                    className="block w-full text-center py-4 px-6 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium text-lg"
                  >
                    報告画面へ進む（修正する）
                  </Link>
                ) : (
                  <div className="block w-full text-center py-4 px-6 bg-gray-100 text-gray-600 rounded-lg font-medium text-lg">
                    他のワーカーが作業中です
                  </div>
                )}
              </>
            )}
          </>
        )}

        {job.status === 'review' && (
          <div className="block w-full text-center py-4 px-6 bg-yellow-100 text-yellow-800 rounded-lg font-medium text-lg">
            確認待ちです
          </div>
        )}

        {job.status === 'completed' && (
          <div className="block w-full text-center py-4 px-6 bg-green-100 text-green-800 rounded-lg font-medium text-lg">
            検収完了
          </div>
        )}
      </main>
    </div>
  );
}

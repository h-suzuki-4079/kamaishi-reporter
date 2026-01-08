'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { supabase } from '@/lib/supabaseClient';
import { Job } from '@/lib/types';
import { formatReward } from '@/lib/types';

export default function Home() {
  const { isAdminMode } = useAdminMode();
  const [reviewJobs, setReviewJobs] = useState<Job[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<Job[]>([]);
  const [openJobs, setOpenJobs] = useState<Job[]>([]);
  const [openUnsubmitted, setOpenUnsubmitted] = useState<Job[]>([]);
  const [openSubmitted, setOpenSubmitted] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // 管理者用：全ステータスの案件を取得
  async function fetchAdminJobs() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .in('status', ['open', 'review', 'assigned'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching jobs:', error);
        return;
      }

      if (data) {
        setReviewJobs(data.filter(job => job.status === 'review'));
        setAssignedJobs(data.filter(job => job.status === 'assigned'));
        setOpenJobs(data.filter(job => job.status === 'open'));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  // ワーカー用：open案件と自分の担当案件を取得
  async function fetchWorkerJobs() {
    try {
      // 募集中の案件を取得
      const { data: openData, error: openError } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (openError) {
        console.error('Error fetching open jobs:', openError);
      } else if (openData) {
        setOpenJobs(openData);
        
        // userIdが取得できている場合、提出済み案件を分ける
        if (userId) {
          // 提出済みjob_idを取得
          const { data: reportsData, error: reportsError } = await supabase
            .from('reports')
            .select('job_id')
            .eq('user_id', userId);

          if (reportsError) {
            console.error('Error fetching reports:', reportsError);
            // エラー時は全て未提出として扱う
            setOpenUnsubmitted(openData);
            setOpenSubmitted([]);
          } else {
            const submittedJobIds = new Set(
              (reportsData || []).map((r: { job_id: number }) => r.job_id)
            );
            
            // 提出済みと未提出に分ける
            const submitted = openData.filter(job => submittedJobIds.has(job.id));
            const unsubmitted = openData.filter(job => !submittedJobIds.has(job.id));
            
            setOpenSubmitted(submitted);
            setOpenUnsubmitted(unsubmitted);
          }
        } else {
          // userIdが取得できていない場合は全て未提出として扱う
          setOpenUnsubmitted(openData);
          setOpenSubmitted([]);
        }
      }

      // localStorageから自分の担当案件IDを取得
      const myJobIds = JSON.parse(localStorage.getItem('my_jobs') || '[]');
      
      if (myJobIds.length > 0) {
        // 数値配列に変換（Supabaseのinクエリ用）
        const numericJobIds = myJobIds.map((id: string | number) => Number(id));
        
        // 自分の担当案件を取得（assignedまたはreview）
        const { data: myData, error: myError } = await supabase
          .from('jobs')
          .select('*')
          .in('id', numericJobIds)
          .in('status', ['assigned', 'review'])
          .order('created_at', { ascending: false });

        if (myError) {
          console.error('Error fetching my jobs:', myError);
        } else if (myData) {
          // assignedとreviewの両方を表示
          setMyJobs(myData);
        }
      } else {
        // localStorageに何もない場合は空配列を設定
        setMyJobs([]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  // userIdを取得
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (isAdminMode) {
      fetchAdminJobs();
    } else {
      fetchWorkerJobs();
    }
  }, [isAdminMode, userId]);

  // 案件カードコンポーネント
  const JobCard = ({ job, showStatus = false, isAssigned = false, showSubmitButton = false, isSubmitted = false }: { job: Job; showStatus?: boolean; isAssigned?: boolean; showSubmitButton?: boolean; isSubmitted?: boolean }) => {
    // 締切判定
    const isClosed = 
      job.status !== 'open' || 
      ((job as any).report_count !== undefined && (job as any).max_submissions !== undefined && 
       (job as any).report_count >= (job as any).max_submissions);

    return (
      <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {job.title}
          </h2>
          <p className="text-gray-600 text-sm mb-1">
            {job.company}
          </p>
          <p className="text-gray-500 text-sm">
            📍 {job.location}
            </p>
          </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-bold text-navy-600">
            {formatReward(job.reward)}
          </span>
          {showStatus && (
            <>
              {job.status === 'review' && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                  確認中
                </span>
              )}
              {job.status === 'assigned' && (
                <>
                  {job.feedback && job.feedback.trim() !== '' ? (
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                      修正依頼
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      作業中
                    </span>
                  )}
                </>
              )}
            </>
          )}
          {/* 提出済みバッジ */}
          {isSubmitted && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              提出済み
            </span>
          )}
          {/* 締切バッジ（募集中の案件で締切の場合） */}
          {showSubmitButton && isClosed && !isSubmitted && (
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
              締切
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/jobs/${job.id}`}
            className="flex-1 text-center py-3 px-4 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium"
          >
            詳細を見る
          </Link>
          {isAdminMode && job.status === 'review' && (
            <Link
              href={`/admin/reports/${job.id}`}
              className="flex-1 text-center py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              報告を確認
            </Link>
          )}
          {!isAdminMode && (job.status === 'assigned' || job.status === 'review') && (
            <Link
              href={`/jobs/${job.id}/report`}
              className="flex-1 text-center py-3 px-4 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors font-medium"
            >
              {job.status === 'review' ? '報告を確認' : '報告を送信'}
            </Link>
          )}
          {/* 募集中の案件の「報告を送信」ボタン */}
          {showSubmitButton && !isAdminMode && !isClosed && !isSubmitted && (
            <Link
              href={`/jobs/${job.id}/report`}
              className="flex-1 text-center py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              報告を送信
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <Header />
      <main className="container mx-auto px-4 py-8 pb-24">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : (
          <>
            {isAdminMode ? (
              // 管理者モード
              <>
                {/* セクションA: 確認待ち（Review） */}
                {reviewJobs.length > 0 && (
                  <section className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">確認待ち（Review）</h1>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {reviewJobs.map((job) => (
                        <JobCard key={job.id} job={job} showStatus={true} />
                      ))}
                    </div>
                  </section>
                )}

                {/* セクションB: 稼働中（Assigned） */}
                {assignedJobs.length > 0 && (
                  <section className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">稼働中（Assigned）</h1>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {assignedJobs.map((job) => (
                        <JobCard key={job.id} job={job} showStatus={true} isAssigned={true} />
                      ))}
                    </div>
                  </section>
                )}

                {/* セクションC: 募集中（Open） */}
                {openJobs.length > 0 && (
                  <section className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">募集中（Open）</h1>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {openJobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                      ))}
                    </div>
                  </section>
                )}

                {reviewJobs.length === 0 && assignedJobs.length === 0 && openJobs.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">現在、案件はありません。</p>
                  </div>
                )}
              </>
            ) : (
              // ワーカーモード
              <>
                {/* あなたの担当案件 */}
                {myJobs.length > 0 && (
                  <section className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">あなたの担当案件（My Jobs）</h1>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {myJobs.map((job) => (
                        <JobCard key={job.id} job={job} showStatus={true} />
                      ))}
                    </div>
                  </section>
                )}

                {/* 募集中の案件 */}
                {openUnsubmitted.length > 0 && (
                  <section className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">募集中の案件</h1>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {openUnsubmitted.map((job) => (
                        <JobCard key={job.id} job={job} showSubmitButton={true} />
                      ))}
                    </div>
                  </section>
                )}

                {/* 提出済みの案件 */}
                {openSubmitted.length > 0 && (
                  <section className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">提出済みの案件</h1>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {openSubmitted.map((job) => (
                        <JobCard key={job.id} job={job} isSubmitted={true} />
                      ))}
                    </div>
                  </section>
                )}

                {/* 案件がない場合のメッセージ */}
                {openUnsubmitted.length === 0 && openSubmitted.length === 0 && (
                  <section className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">募集中の案件</h1>
                    <div className="text-center py-12">
                      <p className="text-gray-500">現在、募集中の案件はありません。</p>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>
      
      {/* 管理者モード時のみ表示される「新しい案件を登録」ボタン */}
      {isAdminMode && (
        <Link
          href="/admin/add"
          className="fixed bottom-6 right-6 z-50 bg-navy-600 text-white px-6 py-4 rounded-full shadow-lg hover:bg-navy-700 transition-colors font-medium flex items-center gap-2"
        >
          <span className="text-2xl">＋</span>
          <span>新しい案件を登録</span>
        </Link>
      )}
    </div>
  );
}

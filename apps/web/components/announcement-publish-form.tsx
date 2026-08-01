'use client';

import { useForm } from 'react-hook-form';
import {
  publishAnnouncementRequestSchema,
  type PublishAnnouncementRequest,
} from '@liveflow/contracts';

type AnnouncementFormValues = {
  content: string;
};

type AnnouncementPublishFormProps = {
  disabled: boolean;
  error: string | null;
  isPending: boolean;
  onPublish: (input: PublishAnnouncementRequest) => Promise<unknown>;
};

const defaultValues: AnnouncementFormValues = {
  content: '',
};

export function AnnouncementPublishForm({
  disabled,
  error,
  isPending,
  onPublish,
}: AnnouncementPublishFormProps) {
  const form = useForm<AnnouncementFormValues>({ defaultValues });

  async function submit(values: AnnouncementFormValues): Promise<void> {
    form.clearErrors();
    const parsedInput = publishAnnouncementRequestSchema.safeParse(values);

    if (!parsedInput.success) {
      form.setError('root', {
        message: parsedInput.error.issues[0]?.message ?? '공지 내용을 다시 확인해 주세요.',
      });
      return;
    }

    try {
      await onPublish(parsedInput.data);
      form.reset(defaultValues);
    } catch {
      // The mutation state below provides a user-safe error message from the API.
    }
  }

  return (
    <section className="announcement-control" aria-labelledby="announcement-control-heading">
      <div className="section-heading">
        <div>
          <p className="panel-kicker">LIVE NOTICE</p>
          <h2 id="announcement-control-heading">시청자 공지 발행</h2>
        </div>
        <p className="mutation-status">저장 완료 후 모든 시청자 화면에 즉시 표시됩니다.</p>
      </div>

      <form className="announcement-form" onSubmit={form.handleSubmit(submit)}>
        <label htmlFor="announcement-content">공지 내용</label>
        <textarea
          aria-describedby="announcement-form-hint"
          disabled={disabled || isPending}
          id="announcement-content"
          maxLength={500}
          placeholder="예: 배송 일정은 오늘 오후 운영자가 다시 안내드리겠습니다."
          rows={3}
          {...form.register('content')}
        />
        <div className="announcement-form-submit">
          <div>
            <p id="announcement-form-hint">최대 500자 · AI 검토 없이 직접 공지할 수 있습니다.</p>
            <p aria-live="polite" className="form-error">
              {form.formState.errors.root?.message ?? error}
            </p>
          </div>
          <button disabled={disabled || isPending} type="submit">
            {isPending ? '공지 발행 중…' : '공지 발행'}
          </button>
        </div>
      </form>
    </section>
  );
}

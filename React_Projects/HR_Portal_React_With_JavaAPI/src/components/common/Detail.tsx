import { useTranslation } from 'react-i18next';
import { Value } from './values';
import { humanize } from '@/components/forms/SchemaFields';

/** Key/value view of any DTO. `labels` overrides, `hide` removes keys; ids stay visible but shortened. */
export function Detail({ data, hide = [], labels = {}, render = {}, cols = 3 }: { data: Record<string, any> | null | undefined; hide?: string[]; labels?: Record<string, string>; render?: Record<string, (v: any, row: any) => React.ReactNode>; cols?: 1 | 2 | 3 }) {
  const { t } = useTranslation();
  if (!data) return null;
  const entries = Object.entries(data).filter(([k, v]) => !hide.includes(k) && !(v && typeof v === 'object' && !Array.isArray(v)));
  const cl = cols === 1 ? 'col-12' : cols === 2 ? 'col-12 col-md-6' : 'col-12 col-sm-6 col-lg-4';
  return (
    <dl className="row g-3 m-0">
      {entries.map(([k, v]) => (
        <div key={k} className={cl}>
          <dt className="field-label m-0">{labels[k] ?? t(`fields.${k}`, { defaultValue: humanize(k) })}</dt>
          <dd className="m-0 text-[13px] break-words">{render[k] ? render[k](v, data) : <Value k={k} v={v} />}</dd>
        </div>
      ))}
    </dl>
  );
}

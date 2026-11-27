import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(v: number | string | null | undefined): string {
    if (v === null || v === undefined || v === '') return '';
    return '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '';
    const s = Math.max(0, (Date.now() - new Date(v).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }
}

/** ORDER_STATUS_UPDATED / "RESTAURANT_ACCEPTED" -> "Restaurant accepted" */
@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
  transform(v: string | null | undefined): string {
    if (!v) return '';
    const t = v.replace(/[_.-]+/g, ' ').toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
}

'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, FormError, Input, Select } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Feedback';
import { useAuth, useToast } from '@/hooks';
import { passengerApi } from '@/services/booking-api';
import { useAppDispatch, useAppSelector } from '@/store';
import { flowReset, newPassenger, passengersSet, seatsCleared, selectFare, stepChanged, submitBooking } from '@/store/bookingSlice';
import { fmtDate, fmtTime, inr } from '@/utils/format';
import { bookingPassengerSchema } from '@/validations/booking';

// Dynamic import: the seat map (tabs, tooltips, polling) is only downloaded on the booking page, not on every page.
const SeatPicker = dynamic(() => import('./SeatPicker').then((m) => m.SeatPicker), { ssr: false, loading: () => <Skeleton className="h-48" /> });
const schema = z.object({ passengers: z.array(bookingPassengerSchema.pick({ name: true, age: true, gender: true })).min(1).max(6) });
type FormValues = { passengers: { name: string; age: string; gender: 'MALE' | 'FEMALE' | 'OTHER' | '' }[] };
const steps = ['Passengers & seats', 'Review', 'Payment'];

/** The booking workflow (Redux Toolkit state + RHF form array + Server Action for the booking request). */
export function BookingFlow() {
  const flow = useAppSelector((s) => s.bookingFlow); const fare = useAppSelector(selectFare); const dispatch = useAppDispatch(); const router = useRouter(); const toast = useToast(); const { user } = useAuth();
  const [pending, start] = useTransition(); const [serverError, setServerError] = useState<string>();
  const saved = useQuery({ queryKey: ['passengers'], queryFn: () => passengerApi.list() });
  useEffect(() => { if (flow.hydrated && !flow.selection) router.replace('/'); }, [flow.hydrated, flow.selection, router]);
  if (!flow.hydrated || !flow.selection) return <Skeleton className="h-64" />;
  return <Inner key={flow.selection.result.train.id + '-' + flow.selection.coachTypeId} userName={user?.name ?? ''} savedList={saved.data ?? []} pending={pending} serverError={serverError} fare={fare}
    onSubmit={() => start(async () => {
      setServerError(undefined); const sel = flow.selection!; const r = sel.result;
      const res = await dispatch(submitBooking({ trainId: r.train.id, date: r.runDate, fromStationId: r.from.station.id, toStationId: r.to.station.id, coachTypeId: sel.coachTypeId,
        passengers: flow.passengers.map((p, i) => ({ name: p.name, age: Number(p.age), gender: p.gender, ...(flow.seatIds.length ? { seatId: flow.seatIds[i] } : {}) })) }));
      if (submitBooking.fulfilled.match(res)) { router.push(`/book/${res.payload.id}/pay`); }
      else { const msg = res.payload ?? 'Could not reserve seats'; setServerError(msg); toast('error', 'Could not reserve seats', msg); if (/seat/i.test(msg)) { dispatch(seatsCleared()); dispatch(stepChanged('passengers')); } }
    })} />;
}

function Inner({ userName, savedList, pending, serverError, fare, onSubmit }: { userName: string; savedList: { id: number; name: string; age: number; gender: 'MALE' | 'FEMALE' | 'OTHER' }[]; pending: boolean; serverError?: string; fare: number; onSubmit: () => void }) {
  const flow = useAppSelector((s) => s.bookingFlow); const dispatch = useAppDispatch(); const router = useRouter();
  const sel = flow.selection!; const { result, coachTypeId } = sel; const cls = result.classes.find((c) => c.coachTypeId === coachTypeId); const review = flow.step === 'review';
  const { control, register, handleSubmit, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: { passengers: flow.passengers.length ? flow.passengers.map((p) => ({ name: p.name, age: p.age, gender: p.gender })) : [{ name: userName, age: '', gender: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'passengers' });
  const seatMismatch = flow.seatIds.length > 0 && flow.seatIds.length !== fields.length;
  const toReview = handleSubmit((v) => { if (seatMismatch) return; dispatch(passengersSet(v.passengers.map((p) => ({ ...newPassenger(p.name), name: p.name, age: String(p.age), gender: p.gender })))); dispatch(stepChanged('review')); });
  const total = (cls?.fare ?? 0) * (review ? flow.passengers.length : fields.length) || fare;
  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Booking steps">{steps.map((s, i) => { const cur = (review ? 1 : 0) === i; return <li key={s} aria-current={cur ? 'step' : undefined} className={`rounded-full px-3 py-1 ${cur ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{i + 1}. {s}</li>; })}</ol>
      <Card><CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{result.train.name} <span className="text-slate-400">#{result.train.number}</span></p><p className="text-sm text-slate-500">{result.from.station.name} → {result.to.station.name} · {fmtDate(result.runDate)} · departs {fmtTime(result.from.departure)}</p></div>
        <div className="text-right"><p className="text-sm text-slate-500">{cls?.name}</p><p className="text-lg font-semibold">{inr(total)}</p></div>
      </CardBody></Card>
      <FormError>{serverError}</FormError>
      {!review ? (
        <form noValidate onSubmit={toReview} className="grid gap-6 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Passengers</CardTitle>{savedList.length > 0 && fields.length < 6 && <Select aria-label="Add a saved passenger" className="w-48" value="" onChange={(e) => { const p = savedList.find((x) => String(x.id) === e.target.value); if (p) append({ name: p.name, age: String(p.age), gender: p.gender }); }}><option value="">+ Add saved passenger</option>{savedList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</CardHeader>
            <CardBody className="space-y-4">
              {fields.map((f, i) => (
                <fieldset key={f.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_90px_130px_auto] dark:border-slate-700"><legend className="px-1 text-xs text-slate-500">Passenger {i + 1}</legend>
                  <Field label="Name" error={errors.passengers?.[i]?.name?.message}><Input {...register(`passengers.${i}.name`)} /></Field>
                  <Field label="Age" error={errors.passengers?.[i]?.age?.message}><Input type="number" min={1} max={120} {...register(`passengers.${i}.age`)} /></Field>
                  <Field label="Gender" error={errors.passengers?.[i]?.gender?.message}><Select {...register(`passengers.${i}.gender`)}><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></Select></Field>
                  <Button type="button" variant="ghost" size="icon" className="mt-6" aria-label={`Remove passenger ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 size={16} /></Button>
                </fieldset>))}
              <Button type="button" variant="outline" size="sm" disabled={fields.length >= 6} onClick={() => append({ name: '', age: '', gender: '' })}><Plus size={16} />Add passenger</Button>
              {seatMismatch && <FormError>You selected {flow.seatIds.length} seat(s) for {fields.length} passenger(s). Select exactly one seat per passenger - or clear the selection for automatic allocation.</FormError>}
              <Button type="submit" className="w-full" onClick={() => dispatch(passengersSet(getValues().passengers.map((p) => ({ ...newPassenger(p.name), name: p.name, age: String(p.age), gender: p.gender }))))}>Review booking<ArrowRight size={16} /></Button>
            </CardBody></Card>
          <Card><CardHeader><CardTitle>Choose seats <span className="text-sm font-normal text-slate-500">(optional)</span></CardTitle>{flow.seatIds.length > 0 && <Button size="sm" variant="ghost" onClick={() => dispatch(seatsCleared())}>Clear ({flow.seatIds.length})</Button>}</CardHeader>
            <CardBody><p className="mb-3 text-sm text-slate-500">Skip this to let us allocate the best available seats together.</p><SeatPicker trainId={result.train.id} from={result.from.station.id} to={result.to.station.id} date={result.runDate} coachTypeId={coachTypeId} maxSeats={fields.length} /></CardBody></Card>
        </form>
      ) : (
        <Card><CardHeader><CardTitle>Review your booking</CardTitle></CardHeader><CardBody className="space-y-4">
          <table className="w-full text-sm"><thead className="text-left text-slate-500"><tr><th className="py-1">Passenger</th><th>Age</th><th>Gender</th><th>Seat</th><th className="text-right">Fare</th></tr></thead>
            <tbody>{flow.passengers.map((p, i) => <tr key={p.key} className="border-t"><td className="py-2 font-medium">{p.name}</td><td>{p.age}</td><td>{p.gender.toLowerCase()}</td><td>{flow.seatIds[i] ? `Chosen (#${flow.seatIds[i]})` : 'Auto-allocated'}</td><td className="text-right">{inr(cls?.fare ?? 0)}</td></tr>)}</tbody></table>
          <p className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total payable</span><span>{inr(total)}</span></p>
          <p className="text-xs text-slate-500">Seats are held for a short time while you pay. The fare is calculated by the booking service and includes the reservation fee.</p>
          <div className="flex justify-between"><Button variant="outline" onClick={() => dispatch(stepChanged('passengers'))}>Back</Button><div className="flex gap-2"><Button variant="ghost" onClick={() => { dispatch(flowReset()); router.push('/'); }}>Cancel</Button><Button loading={pending} onClick={onSubmit}>Reserve &amp; pay<ArrowRight size={16} /></Button></div></div>
        </CardBody></Card>)}
    </div>
  );
}

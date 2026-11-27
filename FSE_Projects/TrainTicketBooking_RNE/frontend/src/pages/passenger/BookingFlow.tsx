import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { bookingPassengerSchema } from '@shared/validations/booking';
import { SeatPicker } from '@/components/SeatPicker';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field, FormError, Input, Select } from '@/components/ui/Field';
import { useAuth, useDocumentTitle, useToast } from '@/hooks';
import { toApiError } from '@/services/api';
import { useCreateBooking, useSavedPassengers } from '@/services/queries';
import { useAppDispatch, useAppSelector } from '@/store';
import { bookingCreated, flowReset, passengersSet, seatsCleared, stepChanged } from '@/store/bookingSlice';
import { fmtDate, fmtTime, inr } from '@/utils/format';
import { useState } from 'react';

const schema = z.object({ passengers: z.array(bookingPassengerSchema.pick({ name: true, age: true, gender: true })).min(1).max(6) });
type FormValues = { passengers: { name: string; age: string; gender: 'MALE' | 'FEMALE' | 'OTHER' | '' }[] };
const steps = ['Passengers & seats', 'Review', 'Payment'];

export default function BookingFlow() {
  useDocumentTitle('Passenger details');
  const flow = useAppSelector((s) => s.bookingFlow); const dispatch = useAppDispatch(); const nav = useNavigate(); const toast = useToast(); const { user } = useAuth();
  const create = useCreateBooking(); const { data: saved = [] } = useSavedPassengers(); const [serverError, setServerError] = useState<string>();
  const { control, register, handleSubmit, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as never, defaultValues: { passengers: flow.passengers.map((p, i) => ({ name: p.name || (i === 0 ? user?.name ?? '' : ''), age: p.age, gender: p.gender })) },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'passengers' });
  const sel = flow.selection;
  useEffect(() => { if (flow.step === 'select') dispatch(stepChanged('passengers')); }, [flow.step, dispatch]);
  if (!sel) return <Navigate to="/" replace />;
  const { result, coachTypeId } = sel; const cls = result.classes.find((c) => c.coachTypeId === coachTypeId); const review = flow.step === 'review';
  const seatMismatch = flow.seatIds.length > 0 && flow.seatIds.length !== fields.length;
  const toReview = handleSubmit((v) => {
    if (seatMismatch) return;
    dispatch(passengersSet(v.passengers.map((p) => ({ key: crypto.randomUUID(), name: p.name, age: String(p.age), gender: p.gender }))));
    dispatch(stepChanged('review'));
  });
  const confirm = async () => {
    setServerError(undefined);
    try {
      const b = await create.mutateAsync({
        trainId: result.train.id, date: result.runDate, fromStationId: result.from.station.id, toStationId: result.to.station.id, coachTypeId,
        passengers: flow.passengers.map((p, i) => ({ name: p.name, age: Number(p.age), gender: p.gender, ...(flow.seatIds.length ? { seatId: flow.seatIds[i] } : {}) })),
      });
      dispatch(bookingCreated(b.id)); nav(`/book/${b.id}/pay`);
    } catch (e) { const err = toApiError(e); setServerError(err.message); toast('error', 'Could not reserve seats', err.message); if (err.status === 409) { dispatch(seatsCleared()); dispatch(stepChanged('passengers')); } }
  };
  const fare = (cls?.fare ?? 0) * (review ? flow.passengers.length : fields.length);
  return (
    <div className="space-y-6">
      <ol className="flex gap-2 text-sm" aria-label="Booking steps">{steps.map((s, i) => { const cur = (review ? 1 : 0) === i; return <li key={s} aria-current={cur ? 'step' : undefined} className={`rounded-full px-3 py-1 ${cur ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}. {s}</li>; })}</ol>
      <Card><CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-semibold">{result.train.name} <span className="text-slate-400">#{result.train.number}</span></p><p className="text-sm text-slate-500">{result.from.station.name} → {result.to.station.name} · {fmtDate(result.runDate)} · departs {fmtTime(result.from.departure)}</p></div>
        <div className="text-right"><p className="text-sm text-slate-500">{cls?.name}</p><p className="text-lg font-semibold">{inr(fare)}</p></div>
      </CardBody></Card>
      <FormError>{serverError}</FormError>
      {!review ? (
        <form noValidate onSubmit={toReview} className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card><CardHeader><CardTitle>Passengers</CardTitle>{saved.length > 0 && fields.length < 6 && <Select aria-label="Add a saved passenger" className="w-48" value="" onChange={(e) => { const p = saved.find((x) => String(x.id) === e.target.value); if (p) append({ name: p.name, age: String(p.age), gender: p.gender }); }}><option value="">+ Add saved passenger</option>{saved.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</CardHeader>
            <CardBody className="space-y-4">
              {fields.map((f, i) => (
                <fieldset key={f.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_90px_130px_auto]"><legend className="px-1 text-xs text-slate-500">Passenger {i + 1}</legend>
                  <Field label="Name" error={errors.passengers?.[i]?.name?.message}><Input {...register(`passengers.${i}.name`)} /></Field>
                  <Field label="Age" error={errors.passengers?.[i]?.age?.message}><Input type="number" min={1} max={120} {...register(`passengers.${i}.age`)} /></Field>
                  <Field label="Gender" error={errors.passengers?.[i]?.gender?.message}><Select {...register(`passengers.${i}.gender`)}><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></Select></Field>
                  <Button type="button" variant="ghost" size="icon" className="mt-6" aria-label={`Remove passenger ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 size={16} /></Button>
                </fieldset>))}
              <Button type="button" variant="outline" size="sm" disabled={fields.length >= 6} onClick={() => append({ name: '', age: '', gender: '' })}><Plus size={16} />Add passenger</Button>
              {seatMismatch && <FormError>You selected {flow.seatIds.length} seat(s) for {fields.length} passenger(s). Select exactly one seat per passenger - or clear the selection for automatic allocation.</FormError>}
              <Button type="submit" className="w-full" onClick={() => dispatch(passengersSet(getValues().passengers.map((p) => ({ key: crypto.randomUUID(), name: p.name, age: String(p.age), gender: p.gender }))))}>Review booking<ArrowRight size={16} /></Button>
            </CardBody></Card>
          <Card><CardHeader><CardTitle>Choose seats <span className="text-sm font-normal text-slate-500">(optional)</span></CardTitle>{flow.seatIds.length > 0 && <Button size="sm" variant="ghost" onClick={() => dispatch(seatsCleared())}>Clear ({flow.seatIds.length})</Button>}</CardHeader>
            <CardBody><p className="mb-3 text-sm text-slate-500">Skip this to let us allocate the best available seats together.</p><SeatPicker trainId={result.train.id} from={result.from.station.id} to={result.to.station.id} date={result.runDate} coachTypeId={coachTypeId} maxSeats={fields.length} /></CardBody></Card>
        </form>
      ) : (
        <Card><CardHeader><CardTitle>Review your booking</CardTitle></CardHeader><CardBody className="space-y-4">
          <table className="w-full text-sm"><thead className="text-left text-slate-500"><tr><th className="py-1">Passenger</th><th>Age</th><th>Gender</th><th>Seat</th><th className="text-right">Fare</th></tr></thead>
            <tbody>{flow.passengers.map((p, i) => <tr key={p.key} className="border-t"><td className="py-2 font-medium">{p.name}</td><td>{p.age}</td><td>{p.gender.toLowerCase()}</td><td>{flow.seatIds[i] ? `Chosen (#${flow.seatIds[i]})` : 'Auto-allocated'}</td><td className="text-right">{inr(cls?.fare ?? 0)}</td></tr>)}</tbody></table>
          <p className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total payable</span><span>{inr(fare)}</span></p>
          <p className="text-xs text-slate-500">Seats are held for 10 minutes while you pay. The fare includes the reservation fee.</p>
          <div className="flex justify-between"><Button variant="outline" onClick={() => dispatch(stepChanged('passengers'))}>Back</Button><div className="flex gap-2"><Button variant="ghost" onClick={() => { dispatch(flowReset()); nav('/'); }}>Cancel</Button><Button loading={create.isPending} onClick={confirm}>Reserve & pay<ArrowRight size={16} /></Button></div></div>
        </CardBody></Card>)}
    </div>
  );
}

import { notFound } from 'next/navigation'
import { getCountryById } from '@/lib/queries'
import CountryModalClient from './CountryModalClient'

export default async function CountryModalPage({
  params,
}: {
  params: Promise<{ countryId: string }>
}) {
  const { countryId } = await params
  const country = await getCountryById(countryId)
  if (!country) notFound()
  return <CountryModalClient country={country} />
}

import { createClient } from '@/utils/supabase/server';
import { data } from 'autoprefixer';

export default async function Instruments() {
  const supabase = await createClient();
  const { data: instruments, error } = await supabase.from("instruments").select();
  console.log({ instruments, error }); // 👈 add this
  return <pre>{JSON.stringify(instruments, null, 2)}</pre>
}
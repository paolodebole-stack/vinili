-- ESEGUIRE UNA SOLA VOLTA in Supabase > SQL Editor > New query.
-- Protegge le collezioni personali: ogni utente può vedere solo le proprie copie.
DROP POLICY IF EXISTS "Authenticated users can view collection items" ON public.collection_items;
DROP POLICY IF EXISTS "Users can view their own collection items" ON public.collection_items;
CREATE POLICY "Users can view their own collection items"
ON public.collection_items
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Crea automaticamente il profilo quando un utente viene registrato,
-- anche se deve ancora confermare l'email.
CREATE OR REPLACE FUNCTION public.handle_new_vinili_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_name text;
  unique_name text;
BEGIN
  base_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''),
    NULLIF(split_part(COALESCE(NEW.email, 'vinilista'), '@', 1), ''),
    'vinilista'
  );
  unique_name := left(regexp_replace(lower(base_name), '[^a-z0-9_]', '', 'g'), 35)
                || '_' || left(replace(NEW.id::text, '-', ''), 6);
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    unique_name,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''), base_name)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_vinili ON auth.users;
CREATE TRIGGER on_auth_user_created_vinili
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_vinili_user();

-- Permette agli utenti autenticati di caricare copertine solo nella propria
-- cartella (il frontend salva i file in una cartella con il proprio user ID).
DROP POLICY IF EXISTS "Authenticated users can upload their own vinyl covers" ON storage.objects;
CREATE POLICY "Authenticated users can upload their own vinyl covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vinyl-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    if (req.method === 'GET') {
      // Fetch all saved locations for user
      const { data, error } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ locations: data });
    }

    if (req.method === 'POST') {
      // Add new saved location
      const { name, type, description, latitude, longitude } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
      }

      const { data, error } = await supabase
        .from('saved_locations')
        .insert({
          user_id: user.id,
          name,
          type,
          description,
          latitude,
          longitude
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Location with this name already exists' });
        }
        throw error;
      }

      return res.status(201).json({ success: true, location: data });
    }

    if (req.method === 'DELETE') {
      // Delete saved location
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Location ID is required' });
      }

      // Verify location belongs to user
      const { data: location, error: fetchError } = await supabase
        .from('saved_locations')
        .select('user_id')
        .eq('id', id)
        .single();

      if (fetchError || location.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { error } = await supabase
        .from('saved_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Saved locations API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

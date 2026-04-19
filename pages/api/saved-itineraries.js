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
      // Fetch all saved itineraries for user
      const { data, error } = await supabase
        .from('saved_itineraries')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ itineraries: data });
    }

    if (req.method === 'POST') {
      // Add new saved itinerary
      const { name, description, start_date, end_date, budget_php, status } = req.body;

      if (!name || !start_date || !end_date) {
        return res.status(400).json({ error: 'Name, start_date, and end_date are required' });
      }

      const { data, error } = await supabase
        .from('saved_itineraries')
        .insert({
          user_id: user.id,
          name,
          description,
          start_date,
          end_date,
          budget_php: budget_php ? Number(budget_php) : null,
          status: status || 'planned'
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, itinerary: data });
    }

    if (req.method === 'PUT') {
      // Update existing itinerary
      const { id, name, description, start_date, end_date, budget_php, status } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Itinerary ID is required' });
      }

      // Verify itinerary belongs to user
      const { data: itinerary, error: fetchError } = await supabase
        .from('saved_itineraries')
        .select('user_id')
        .eq('id', id)
        .single();

      if (fetchError || itinerary.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { data, error } = await supabase
        .from('saved_itineraries')
        .update({
          name,
          description,
          start_date,
          end_date,
          budget_php: budget_php ? Number(budget_php) : null,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, itinerary: data });
    }

    if (req.method === 'DELETE') {
      // Delete saved itinerary
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Itinerary ID is required' });
      }

      // Verify itinerary belongs to user
      const { data: itinerary, error: fetchError } = await supabase
        .from('saved_itineraries')
        .select('user_id')
        .eq('id', id)
        .single();

      if (fetchError || itinerary.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { error } = await supabase
        .from('saved_itineraries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Saved itineraries API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

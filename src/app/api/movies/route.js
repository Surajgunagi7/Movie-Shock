import dbConnect from '@/lib/db';
import Movie from '@/models/Movie';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log(`[API] GET /api/movies - Initiating database connection`);
    await dbConnect();
    const movies = await Movie.find({});
    console.log(`[API] GET /api/movies - Successfully fetched ${movies.length} items`);
    return NextResponse.json(movies);
  } catch (error) {
    console.error('Failed to get movies', error);
    return NextResponse.json({ error: 'Failed to fetch movies' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    // The client sends the entire collection, similar to the old Express server logic
    // We can replace the whole collection, or better, we can modify the client logic 
    // to just send the newly added items, but to keep logic similar without heavy modification:
    
    await dbConnect();
    const entries = await req.json();
    console.log(`[API] POST /api/movies - Incoming payload with ${entries.length} items`);

    if (!Array.isArray(entries)) {
        console.warn(`[API] POST /api/movies - Rejected: Payload is not an array`);
        return NextResponse.json({ error: 'Expected array' }, { status: 400 });
    }

    // Clear existing and rewrite (mirroring exactly what the CSV saving did)
    // Though it's not the most efficient for MongoDB, it preserves the exact structure the user liked.
    console.log(`[API] POST /api/movies - Wiping old collection and inserting new data...`);
    await Movie.deleteMany({});
    await Movie.insertMany(entries);
    
    console.log(`[API] POST /api/movies - Successfully saved ${entries.length} items`);
    return NextResponse.json({ ok: true, count: entries.length });
  } catch (error) {
    console.error('Failed to save movies', error);
    return NextResponse.json({ error: 'Failed to save movies' }, { status: 500 });
  }
}

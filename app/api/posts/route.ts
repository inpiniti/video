
import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

const BOARD_LIST_FILE = path.join(process.cwd(), 'boardList.json');

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    try {
        if (!await fs.pathExists(BOARD_LIST_FILE)) {
            return NextResponse.json({ data: [], nextCursor: null });
        }

        const data = await fs.readJson(BOARD_LIST_FILE);

        // Sort by ID desc or date desc if needed, currently just taking as is (usually scraped in order)
        // Let's reverse to show newest first if scraping was old->new
        // But scraping was 0->1850, so page 0 is newest usually on these sites.
        // Let's assume the order in file is correct for now.

        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedData = data.slice(start, end);

        const hasMore = end < data.length;

        return NextResponse.json({
            data: paginatedData,
            nextCursor: hasMore ? page + 1 : null,
        });
    } catch (error) {
        console.error('Error reading boardList.json:', error);
        return NextResponse.json({ data: [], nextCursor: null }, { status: 500 });
    }
}

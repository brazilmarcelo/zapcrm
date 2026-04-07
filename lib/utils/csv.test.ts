import { describe, expect, it } from 'vitest';
import { detectCsvDelimiter, parseCsv, stringifyCsv } from './csv';

describe('csv utils', () => {
  it('detects delimiter from header line', () => {
    expect(detectCsvDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectCsvDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectCsvDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('parses quoted fields and escaped quotes', () => {
    const input = 'name,email\n"João ""Test""",joao@x.com\n';
    const { headers, rows } = parseCsv(input, ',');
    expect(headers).toEqual(['name', 'email']);
    expect(rows).toEqual([['João "Test"', 'joao@x.com']]);
  });

  it('stringifies and roundtrips basic CSV', () => {
    const rows = [
      ['name', 'notes'],
      ['Alice', 'hello, world'],
      ['Bob', 'line1\nline2'],
    ];
    const csv = stringifyCsv(rows, ',');
    const parsed = parseCsv(csv, ',');
    expect([parsed.headers, ...parsed.rows]).toEqual(rows);
  });
});


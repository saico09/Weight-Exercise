import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoData } from '../lib/model';
import { HistoryPage } from './Insights';

describe('Pro history export availability', () => {
  it.each([true, false])('allows downloading every month when demo=%s', demo => {
    const data = demoData();
    const html = renderToStaticMarkup(<HistoryPage data={data} demo={demo} onProfile={() => {}} onRecord={() => {}} onNewRecord={() => {}} onHeightUnit={() => {}} />);
    const downloads = html.match(/<button\b[^>]*aria-label="Descargar Excel · [^"]+"[^>]*>/g) ?? [];
    expect(downloads).toHaveLength(new Set(data.records.map(record => record.date.slice(0, 7))).size);
    for (const button of downloads) expect(button).not.toMatch(/\sdisabled(?:=|\s|>)/);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { localeFromSearch, t, translateBackend, catalog } from '../dist/i18n.mjs';

test('URL language is explicitly Russian or English and otherwise English', () => {
  for (const search of ['', '?x=1', '?lang=fr', '?lang=RU', '?lang=ru-RU', '?language=ru', '?lang=%00']) assert.equal(localeFromSearch(search), 'en');
  assert.equal(localeFromSearch('?x=1&lang=ru'), 'ru');
  assert.equal(localeFromSearch('?lang=en&x=ru'), 'en');
});

test('partial Grow guidance offers release of the visible fragment in both languages', () => {
  assert.match(t('action.shapePartialGrow', 'en', {operation:'Grow'}), /release now.*visible fragment/i);
  assert.match(t('action.shapePartialGrow', 'ru', {operation:'Рост'}), /отпуст.*видимый фрагмент/i);
});

test('catalog translates static labels and statuses in both languages', () => {
  assert.equal(t('source.files', 'en'), 'Files / ZIP');
  assert.equal(t('source.files', 'ru'), 'Файлы / ZIP');
  assert.equal(t('adaptive.propose', 'ru'), 'Предложить заполнение');
  assert.equal(t('action.undo', 'ru'), 'Отменить');
  assert.equal(t('status.noVolume', 'ru'), 'Том не загружен.');
  assert.equal(t('status.noVolume', 'fr'), 'No volume loaded.');
  assert.match(t('action.shapeContinuationRefused', 'ru', {operation: 'Рост', reason: 'Нет края'}), /предыдущее полное предложение сохранено/);
  assert.match(t('action.shapeAccepted', 'ru', {operation: 'Рост', count: 5, edit: 'добавлено', clipped: ''}), /5.*вокселей/);
  assert.match(t('action.pointsReady', 'ru', {target: 2, background: 1}), /2.*1.*маска ещё не изменена/);
  assert.match(t('confirm.reset', 'ru'), /Отмена восстановит/);
  assert.throws(() => t('nonexistent', 'ru'), /Unknown message key/);
  for (const [key, pair] of Object.entries(catalog)) {
    assert.equal(typeof pair.en, 'string', key);
    assert.equal(typeof pair.ru, 'string', key);
    assert.ok(pair.en.length && pair.ru.length, key);
  }
});

test('safe interpolation is text only and leaves no raw HTML execution', () => {
  assert.equal(t('status.seriesChoice', 'ru', {found: 2, skipped: 1}), 'Выберите серию (найдено: 2; пропущено: 1).');
  assert.match(t('status.scan', 'en', {input: '<img src=x onerror=alert(1)>'}), /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal(t('status.scan', 'en', {input: undefined}), 'Scanning · ');
});

test('seam and reduction warning preserve dimensions and source-Z statement', () => {
  const seam = 'Две последовательные съёмки перекрываются на одном срезе. Один граничный срез исключён; проверь область стыка перед оценкой объёма.';
  const reduction = 'Большая серия: пиксели усреднены в плоскости 2×2 (с 512×512×611 до 256×256×611); все исходные позиции срезов по Z сохранены. Сегментация и объём приблизительные: тонкие очаги и границы могли измениться. Исходные DICOM не изменены.';
  assert.match(translateBackend(seam, 'en'), /overlap on one slice.*boundary slice.*review the seam/i);
  assert.match(translateBackend(reduction, 'en'), /2×2.*512×512×611.*256×256×611.*original Z slice positions.*approximate/i);
  assert.equal(translateBackend(reduction, 'ru'), reduction);
});

test('worker errors and mixed nested error stay in requested language', () => {
  assert.equal(translateBackend('Слишком большой файл внутри ZIP.', 'en'), 'File inside ZIP is too large.');
  assert.equal(translateBackend('File inside ZIP is too large.', 'ru'), 'Слишком большой файл внутри ZIP.');
  assert.equal(translateBackend('Чтение DICOM', 'en'), 'Reading DICOM');
  assert.equal(translateBackend('Full image stack', 'ru'), 'Полный набор срезов');
  assert.equal(translateBackend('Две последовательные съёмки перекрываются на одном срезе. Один граничный срез исключён.', 'en'), 'Two consecutive acquisitions overlap on one slice. One boundary slice was excluded.');
  assert.equal(translateBackend('Only CT and MR image series are supported.', 'ru'), 'Поддерживаются только серии КТ и МР.');
  assert.match(translateBackend('Не найдена подходящая DICOM-серия: проверено 42 файлов, пропущено 3. Слишком большой файл внутри ZIP.', 'en'), /No suitable DICOM series found: checked 42 files, skipped 3\. File inside ZIP is too large\./);
  assert.equal(translateBackend('Transfer Syntax 1.2.3 пока не поддерживается. Экспортируй DICOM без сжатия.', 'en'), 'Transfer Syntax 1.2.3 is not supported yet. Export uncompressed DICOM.');
});

test('adaptive and morphology worker reasons translate without changing unknown diagnostic text', () => {
  assert.match(translateBackend('Proposal touches the spatial search boundary; inspect for truncation.', 'ru'), /границы области поиска/);
  assert.match(translateBackend('No connected pixels match the clean click core', 'ru'), /связных пикселей/);
  assert.match(translateBackend('Preview only: 12 voxels would be added and 3 removed. Review before acceptance.', 'ru'), /12.*3/);
  assert.equal(translateBackend('Mask ROI exceeds the 3000000-voxel budget; no partial preview.', 'ru'), 'Область маски превышает лимит 3000000 вокселей; частичный предпросмотр отсутствует.');
  assert.equal(translateBackend('Closing halo exceeds the 3000000-voxel budget; no partial preview.', 'ru'), 'Область закрытия превышает лимит 3000000 вокселей; частичный предпросмотр отсутствует.');
  assert.equal(translateBackend('Invalid volume, geometry, seed or bounds.', 'ru'), 'Неверный том, геометрия, затравка или границы.');
  assert.equal(translateBackend('unknown browser exception', 'en'), 'unknown browser exception');
});

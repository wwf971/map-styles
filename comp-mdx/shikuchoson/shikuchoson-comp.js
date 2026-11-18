import { compDefine } from '@wwf971/react-doc';
import { ShikuchosonSelector } from './ShikuchosonSelector.jsx';

// the mode of a frontend object of the type shikuchoson.jp, never written as a block itself
export const ShikuchosonSelectorDefine = compDefine(ShikuchosonSelector, {
	placementList: ['objectFrontend'],
	expose: { meta: { label: 'Japanese area selector', description: 'Regions, prefectures and municipalities of Japan, selected together', isNotInDoc: true } },
});

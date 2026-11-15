import PrefectureSelectorEl from './geo/PrefectureSelectorEl';
import './demo-map-block.css';

function DemoMapBlock() {
  return (
    <section className="map-block-demo">
      <div className="map-block-demo-body">
        <PrefectureSelectorEl eyebrow="Tile grid map" title="都道府県タイルマップ" />
      </div>
    </section>
  );
}

export default DemoMapBlock;
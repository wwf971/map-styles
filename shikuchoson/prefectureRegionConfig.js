export const prefectureRegionList = [
  {
    id: 'hokkaido-tohoku',
    label: '北海道・東北',
    colorName: 'teal',
    colorValue: '#bceee0',
    prefectureLabelList: ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島'],
  },
  {
    id: 'kanto',
    label: '関東',
    colorName: 'yellow',
    colorValue: '#f3e889',
    prefectureLabelList: ['茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川'],
  },
  {
    id: 'chubu',
    label: '中部',
    colorName: 'coral',
    colorValue: '#f2a391',
    prefectureLabelList: ['新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知'],
  },
  {
    id: 'kinki',
    label: '近畿',
    colorName: 'pink',
    colorValue: '#ee8cad',
    prefectureLabelList: ['三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山'],
  },
  {
    id: 'chugoku-shikoku',
    label: '中国・四国',
    colorName: 'violet',
    colorValue: '#b994d1',
    prefectureLabelList: ['鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知'],
  },
  {
    id: 'kyushu-okinawa',
    label: '九州・沖縄',
    colorName: 'indigo',
    colorValue: '#8a91d9',
    prefectureLabelList: ['福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'],
  },
];

export const prefectureRegionByLabel = Object.fromEntries(
  prefectureRegionList.flatMap((region) => (
    region.prefectureLabelList.map((prefectureLabel) => [prefectureLabel, region])
  )),
);
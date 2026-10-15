import { useId } from 'react';
import type { Theme } from '../lib/model';
import './themes.css';

/** Original vector scenery. The moving layers never take part in page layout. */
export function ThemeAtmosphere({ theme }: { theme: Theme }) {
  const id = useId().replace(/:/g, '');
  if (theme !== 'aurora' && theme !== 'sand') return null;
  const aurora = theme === 'aurora';
  return <div className={`theme-atmosphere atmosphere-${theme}`} aria-hidden="true">
    <svg className="atmosphere-scenery" viewBox="0 0 1440 1000" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={aurora ? '#bd8fff' : '#d9b88c'} stopOpacity={aurora ? '.04' : '.15'} />
          <stop offset=".45" stopColor={aurora ? '#a176f1' : '#d2a26d'} stopOpacity={aurora ? '.44' : '.42'} />
          <stop offset="1" stopColor={aurora ? '#525ca1' : '#f8e2bb'} stopOpacity={aurora ? '.03' : '.12'} />
        </linearGradient>
        <linearGradient id={`${id}-near`} x1="0" y1="0" x2=".15" y2="1">
          <stop offset="0" stopColor={aurora ? '#c6a4ff' : '#fff5de'} stopOpacity={aurora ? '.45' : '.8'} />
          <stop offset=".24" stopColor={aurora ? '#7555b5' : '#ddbd91'} stopOpacity={aurora ? '.2' : '.5'} />
          <stop offset="1" stopColor={aurora ? '#15192f' : '#d5ab7d'} stopOpacity={aurora ? '0' : '.09'} />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={aurora ? '#d8c6ff' : '#fff9ec'} stopOpacity="0" />
          <stop offset=".45" stopColor={aurora ? '#cfb7ff' : '#fffaf0'} stopOpacity={aurora ? '.65' : '.95'} />
          <stop offset="1" stopColor={aurora ? '#aa9ce8' : '#f4ddb8'} stopOpacity="0" />
        </linearGradient>
      </defs>
      {aurora ? <>
        <g className="atmosphere-layer atmosphere-layer-far">
          <path fill={`url(#${id}-far)`} d="M-200 290 C160 160 350 650 760 420 S1290 150 1650 350 L1650 620 C1200 340 1060 520 690 610 S130 360 -200 530Z" />
          <path className="atmosphere-edge" stroke={`url(#${id}-edge)`} d="M-200 290 C160 160 350 650 760 420 S1290 150 1650 350" />
        </g>
        <g className="atmosphere-layer atmosphere-layer-mid">
          <path fill={`url(#${id}-far)`} d="M-200 700 C220 350 440 470 840 640 S1290 410 1650 490 L1650 950 C1320 710 1120 830 770 790 S200 610 -200 900Z" />
          <path className="atmosphere-edge" stroke={`url(#${id}-edge)`} d="M-200 700 C220 350 440 470 840 640 S1290 410 1650 490" />
        </g>
        <g className="atmosphere-layer atmosphere-layer-near">
          <path fill={`url(#${id}-near)`} d="M-200 810 C120 930 380 580 780 700 S1240 1010 1650 630 V1200 H-200Z" />
          <path className="atmosphere-edge" stroke={`url(#${id}-edge)`} d="M-200 810 C120 930 380 580 780 700 S1240 1010 1650 630" />
        </g>
      </> : <>
        <g className="atmosphere-layer atmosphere-layer-far">
          <path fill={`url(#${id}-far)`} d="M-200 410 C140 570 360 210 780 390 S1280 640 1650 270 V1200 H-200Z" />
          <path className="atmosphere-edge" stroke={`url(#${id}-edge)`} d="M-200 410 C140 570 360 210 780 390 S1280 640 1650 270" />
        </g>
        <g className="atmosphere-layer atmosphere-layer-mid">
          <path fill={`url(#${id}-near)`} d="M-200 810 C160 350 430 700 820 600 S1290 440 1650 700 V1200 H-200Z" />
          <path className="atmosphere-edge" stroke={`url(#${id}-edge)`} d="M-200 810 C160 350 430 700 820 600 S1290 440 1650 700" />
        </g>
        <g className="atmosphere-layer atmosphere-layer-near">
          <path fill={`url(#${id}-far)`} d="M-200 860 C200 910 440 630 840 790 S1300 860 1650 730 V1200 H-200Z" />
          <path className="atmosphere-edge" stroke={`url(#${id}-edge)`} d="M-200 860 C200 910 440 630 840 790 S1300 860 1650 730" />
        </g>
        <g className="atmosphere-wind" fill="none" stroke={`url(#${id}-edge)`}>
          <path d="M-180 600 C240 420 380 820 820 660 S1280 560 1610 640" />
          <path d="M-180 619 C240 439 380 839 820 679 S1280 579 1610 659" />
          <path d="M-180 641 C240 461 380 861 820 701 S1280 601 1610 681" />
          <path d="M-180 666 C240 486 380 886 820 726 S1280 626 1610 706" />
          <path d="M-180 694 C240 514 380 914 820 754 S1280 654 1610 734" />
          <path d="M-180 725 C240 545 380 945 820 785 S1280 685 1610 765" />
        </g>
      </>}
    </svg>
  </div>;
}


import React from 'react';

import dynamic from 'next/dynamic';

import { GrowiThemes } from '~/interfaces/theme';


const ThemeAntarctic = dynamic(() => import('../ThemeAntarctic'));
const ThemeBlackboard = dynamic(() => import('../ThemeBlackboard'));
const ThemeChristmas = dynamic(() => import('../ThemeChristmas'));
const ThemeDefault = dynamic(() => import('../ThemeDefault'));
const ThemeJadeGreen = dynamic(() => import('../ThemeJadeGreen'));


type Props = {
  children: JSX.Element,
  theme?: GrowiThemes,
}

export const ThemeProvider = ({ theme, children }: Props): JSX.Element => {
  switch (theme) {
    case GrowiThemes.ANTARCTIC:
      return <ThemeAntarctic>{children}</ThemeAntarctic>;
    case GrowiThemes.BLACKBOARD:
      return <ThemeBlackboard>{children}</ThemeBlackboard>;
    case GrowiThemes.CHRISTMAS:
      return <ThemeChristmas>{children}</ThemeChristmas>;
    case GrowiThemes.JADE_GREEN:
      return <ThemeJadeGreen>{children}</ThemeJadeGreen>;
    default:
      return <ThemeDefault>{children}</ThemeDefault>;
  }
};
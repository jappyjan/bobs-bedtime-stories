import {StrictMode} from 'react';
import * as ReactDOM from 'react-dom';
import {BrowserRouter} from 'react-router-dom';
import '@shoelace-style/shoelace/dist/themes/light.css';
import '@shoelace-style/shoelace/dist/themes/dark.css';
import {setBasePath as shoelaceSetBasePath} from '@shoelace-style/shoelace/dist/utilities/base-path';
import "css-baseline/css/2.css";
import './main.style.css';

shoelaceSetBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.0.0-beta.64/dist/');

import App from './app/app';

ReactDOM.render(
  <StrictMode>
    <BrowserRouter>
      <App/>
    </BrowserRouter>
  </StrictMode>,
  document.getElementById('root')
);

import React from 'react';
import { RelativeTime } from '../components/relative-time';
import { renderToString } from 'react-dom/server';
console.log(renderToString(<RelativeTime value="2025-10-15T10:28:26.949Z" />));

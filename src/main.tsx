import React from 'react';
import ReactDOM from 'react-dom/client';
// import { RouterProvider } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import AppRouter from '../src/routes/routes';
import './global.css';
import { AuthProvider } from './context/Authcontext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider >
    </Provider>
  </React.StrictMode>,
);

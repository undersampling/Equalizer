import React from 'react';
import MainPage from './pages/MainPage';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <MainPage />
      </div>
    </ErrorBoundary>
  );
}

export default App;
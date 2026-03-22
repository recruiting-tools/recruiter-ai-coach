import { Routes, Route, Navigate } from 'react-router-dom'
import LivePage from './pages/LivePage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/live" element={<LivePage />} />
      <Route path="*" element={<Navigate to="/live" replace />} />
    </Routes>
  )
}

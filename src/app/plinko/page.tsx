"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const COLS = 16
const INITIAL_BALANCE = 1000
const GRAVITY = 0.2
const HORIZONTAL_VELOCITY = 0.8

export default function Component() {
    const [balls, setBalls] = useState<Array<{ id: number, x: number, y: number, vx: number, vy: number }>>([])
    const [balance, setBalance] = useState(INITIAL_BALANCE)
    const [betAmount, setBetAmount] = useState(1)
    const [risk, setRisk] = useState("medium")
    const [rows, setRows] = useState("16")
    const [activeSlot, setActiveSlot] = useState<number | null>(null)
    const [isAuto, setIsAuto] = useState(false)
    const [showStats, setShowStats] = useState(false)
    const [stats, setStats] = useState<{ profit: number, wins: number, losses: number, history: Array<{ time: number, profit: number }> }>({ profit: 0, wins: 0, losses: 0, history: [] })
    const [recentMultipliers, setRecentMultipliers] = useState<Array<number>>([])
    const boardRef = useRef<HTMLDivElement>(null)
    const autoIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const slotMultipliers = useMemo(() => [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110], [])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedBalance = localStorage.getItem('plinkoBalance')
            if (savedBalance) {
                setBalance(parseFloat(savedBalance))
            }

            const savedStats = localStorage.getItem('plinkoStats')
            if (savedStats) {
                const parsedStats = JSON.parse(savedStats) as { profit: number; wins: number; losses: number; history: { time: number; profit: number; }[] };
                setStats(parsedStats);
            }

            const savedMultipliers = localStorage.getItem('plinkoRecentMultipliers')
            if (savedMultipliers) {
                const parsedMultipliers = JSON.parse(savedMultipliers) as number[];
                setRecentMultipliers(parsedMultipliers);
            }
        }
    }, [])

    const getSlotColor = (multiplier: number) => {
        if (multiplier >= 41) return 'bg-red-500'
        if (multiplier >= 10) return 'bg-orange-500'
        if (multiplier >= 3) return 'bg-yellow-500'
        if (multiplier >= 1) return 'bg-green-500'
        return 'bg-blue-500'
    }

    const createBall = useCallback(() => {
        const startCol = Math.floor(Math.random() * (COLS - 1)) + 0.5
        return {
            id: Date.now(),
            x: startCol * (300 / (COLS - 1)),
            y: -10,
            vx: (Math.random() - 0.5) * 2,
            vy: 0,
        }
    }, [])

    const updateBallPosition = useCallback((ball: { id: number, x: number, y: number, vx: number, vy: number }) => {
        let { x, y, vx, vy } = ball

        vy += GRAVITY
        x += vx
        y += vy

        // Boundary checks
        if (x < 0 || x > 300) {
            vx *= -1
            x = x < 0 ? 0 : 300
        }

        if (y > 450) {
            const slot = Math.floor((x / 300) * COLS)
            const multiplier = slotMultipliers[slot]
            if (multiplier !== undefined) {
                const winAmount = Math.floor(betAmount * multiplier)
                const profit = winAmount - betAmount
                setBalance(prev => {
                    const newBalance = prev + winAmount
                    localStorage.setItem('plinkoBalance', newBalance.toString())
                    return newBalance
                })
                setActiveSlot(slot)
                setStats(prev => {
                    const newStats = {
                        profit: prev.profit + profit,
                        wins: prev.wins + (profit > 0 ? 1 : 0),
                        losses: prev.losses + (profit <= 0 ? 1 : 0),
                        history: [...prev.history, { time: Date.now(), profit }]
                    }
                    localStorage.setItem('plinkoStats', JSON.stringify(newStats))
                    return newStats
                })
                setRecentMultipliers(prev => {
                    const newMultipliers = [multiplier, ...prev.slice(0, 2)]
                    localStorage.setItem('plinkoRecentMultipliers', JSON.stringify(newMultipliers))
                    return newMultipliers
                })
                setTimeout(() => setActiveSlot(null), 500)
            }
            return null // Remove the ball
        }

        // Collision with pegs
        const pegX = Math.round(x / (300 / (COLS - 1))) * (300 / (COLS - 1))
        const pegY = Math.round(y / 25) * 25
        const distX = x - pegX
        const distY = y - pegY
        if (Math.sqrt(distX * distX + distY * distY) < 5) {
            const angle = Math.atan2(distY, distX)
            vx = Math.cos(angle) * HORIZONTAL_VELOCITY * (Math.random() + 0.5)
            vy = Math.abs(Math.sin(angle) * HORIZONTAL_VELOCITY * (Math.random() + 0.5))
            x = pegX + Math.cos(angle) * 6
            y = pegY + Math.sin(angle) * 6
        }

        return { ...ball, x, y, vx, vy }
    }, [betAmount, slotMultipliers])

    const dropBall = useCallback(() => {
        if (balance < betAmount) return
        setBalance(prev => {
            const newBalance = prev - betAmount
            localStorage.setItem('plinkoBalance', newBalance.toString())
            return newBalance
        })
        setBalls(prev => [...prev, createBall()])
    }, [balance, betAmount, createBall])

    const toggleAuto = () => {
        setIsAuto(prev => !prev)
    }

    useEffect(() => {
        if (isAuto) {
            autoIntervalRef.current = setInterval(dropBall, 1000)
        } else {
            if (autoIntervalRef.current) clearInterval(autoIntervalRef.current)
        }

        return () => {
            if (autoIntervalRef.current) clearInterval(autoIntervalRef.current)
        }
    }, [isAuto, dropBall])

    useEffect(() => {
        const animationFrame = requestAnimationFrame(function animate() {
            setBalls(prev => prev.map(updateBallPosition).filter(Boolean) as Array<{ id: number, x: number, y: number, vx: number, vy: number }>)
            requestAnimationFrame(animate)
        })
        return () => {
            cancelAnimationFrame(animationFrame)
            if (autoIntervalRef.current) clearInterval(autoIntervalRef.current)
        }
    }, [updateBallPosition])

    return (
        <main className="flex w-screen min-h-screen h-full flex-col items-center space-y-4 p-4 bg-gray-900 text-white mx-auto">
            <div className="w-full flex justify-between items-center">
                <h1 className="text-2xl font-bold">Plinko</h1>
                <span className="text-xl">${balance.toFixed(2)}</span>
            </div>

            <div className="w-full flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/3 space-y-4 bg-gray-800 p-4 rounded-lg">
                    <div className="flex justify-between">
                        <Button variant="secondary" size="sm" className="text-white bg-gray-600 hover:bg-gray-500">Manual</Button>
                        <Button
                            variant={isAuto ? "secondary" : "outline"}
                            size="sm"
                            onClick={toggleAuto}
                            className="text-white bg-gray-600 border-none hover:bg-gray-500 hover:text-white"
                        >
                            {isAuto ? "Stop Auto" : "Start Auto"}
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm">Bet Amount</label>
                        <div className="flex items-center space-x-2">
                            <Input
                                type="number"
                                value={betAmount}
                                onChange={(e) => setBetAmount(Number(e.target.value))}
                                className="flex-grow bg-gray-700 text-white placeholder-gray-400 border-gray-600"
                                placeholder="Enter bet amount"
                            />
                            <Button variant="secondary" size="sm" onClick={() => setBetAmount(prev => prev / 2)}>½</Button>
                            <Button variant="secondary" size="sm" onClick={() => setBetAmount(prev => prev * 2)}>2x</Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm">Risk</label>
                        <Select value={risk} onValueChange={setRisk}>
                            <SelectTrigger className="bg-gray-700 text-white border-gray-600">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm">Rows</label>
                        <Select value={rows} onValueChange={setRows}>
                            <SelectTrigger className="bg-gray-700 text-white border-gray-600">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="8">8</SelectItem>
                                <SelectItem value="12">12</SelectItem>
                                <SelectItem value="16">16</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="w-full bg-green-500 hover:bg-green-600 text-white" onClick={dropBall}>Drop Ball</Button>

                    <Button
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={() => setShowStats(prev => !prev)}
                    >
                        {showStats ? "Hide Stats" : "Show Stats"}
                    </Button>

                    <div className="flex justify-between items-center">
                        <span className="text-sm">Recent Multipliers:</span>
                        <div className="flex space-x-2">
                            {recentMultipliers.map((mult, index) => (
                                <span key={index} className={`text-sm font-bold ${getSlotColor(mult)} px-2 py-1 rounded`}>
                                    {mult}x
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-2/3 bg-gray-800 rounded-lg overflow-hidden flex justify-center items-center">
                    <div className="w-full md:w-2/3 bg-gray-800 overflow-hidden max-w-lg">
                        <div ref={boardRef} className="relative w-full h-[450px]">
                            {/* Pegs */}
                            {Array.from({ length: Number(rows) }).map((_, rowIndex) => (
                                <div key={rowIndex} className="absolute w-full" style={{ top: `${(rowIndex + 1) * 25}px` }}>
                                    {Array.from({ length: COLS - rowIndex % 2 }).map((_, colIndex) => (
                                        <div
                                            key={colIndex}
                                            className="absolute w-2 h-2 bg-gray-400 rounded-full"
                                            style={{ left: `${(colIndex + (rowIndex % 2 ? 0.5 : 0)) * (100 / (COLS - 1))}%` }}
                                        />
                                    ))}
                                </div>
                            ))}

                            {/* Balls */}
                            <AnimatePresence>
                                {balls.map(ball => (
                                    <motion.div
                                        key={ball.id}
                                        className="absolute w-3 h-3 bg-white rounded-full"
                                        style={{ x: ball.x - 6, y: ball.y - 6 }}
                                        exit={{ opacity: 0 }}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Multiplier slots */}
                        <div className="flex justify-between">
                            {slotMultipliers.map((multiplier, index) => (
                                <motion.div
                                    key={index}
                                    className={`flex-1 h-8 ${getSlotColor(multiplier)} flex items-center justify-center text-xs font-bold`}
                                    animate={{
                                        scale: activeSlot === index ? 1.1 : 1,
                                        transition: { type: 'spring', stiffness: 300, damping: 15 }
                                    }}
                                >
                                    {multiplier}x
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showStats && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="w-full bg-gray-800 p-4 rounded-lg"
                    >
                        <div className="w-full bg-gray-800 p-4 rounded-lg">
                            <h2 className="text-xl font-bold mb-2">Statistics</h2>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div>
                                    <p className="text-sm">Profit</p>
                                    <p className={`text-lg font-bold ${stats.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        ${stats.profit.toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm">Wins</p>
                                    <p className="text-lg font-bold text-green-500">{stats.wins}</p>
                                </div>
                                <div>
                                    <p className="text-sm">Losses</p>
                                    <p className="text-lg font-bold text-red-500">{stats.losses}</p>
                                </div>
                            </div>
                            {stats.history.length > 0 && (
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={stats.history}>
                                        <XAxis dataKey="time" tick={false} />
                                        <YAxis />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                                            labelStyle={{ color: '#9CA3AF' }}
                                            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Profit']}
                                            labelFormatter={(label: number) => new Date(label).toLocaleTimeString()}
                                        />
                                        {/* TODO: Make line red when profit is negative */}
                                        <Line type="monotone" dataKey="profit" stroke="#10B981" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    )
}
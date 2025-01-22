import { expect, describe, it } from 'vitest'
import { calculateSpeedByHeartRate, calculateSpeedByTempo } from './speedCalculator'
import { Timespan } from '@/services/Timespan'
import dayjs from 'dayjs'

describe('Speed Calculator', () => {
  it('speed is not changed when heart rate is similar to target', () => {
    let newSpeed = calculateSpeedByHeartRate(125, 125, 10)
    expect(newSpeed).toBe(10)
    newSpeed = calculateSpeedByHeartRate(120, 125, 10)
    expect(newSpeed).toBe(10)
    newSpeed = calculateSpeedByHeartRate(130, 125, 10)
    expect(newSpeed).toBe(10)
  })

  it('speed is changed heart rate is highly different', () => {
    let newSpeed = calculateSpeedByHeartRate(70, 145, 10)
    expect(newSpeed).toBe(10.8)
    newSpeed = calculateSpeedByHeartRate(80, 145, 10)
    expect(newSpeed).toBe(10.7)
    newSpeed = calculateSpeedByHeartRate(90, 145, 10)
    expect(newSpeed).toBe(10.6)
    newSpeed = calculateSpeedByHeartRate(100, 145, 10)
    expect(newSpeed).toBe(10.5)
    newSpeed = calculateSpeedByHeartRate(120, 145, 10)
    expect(newSpeed).toBe(10.3)
    newSpeed = calculateSpeedByHeartRate(130, 145, 10)
    expect(newSpeed).toBe(10.2)
    newSpeed = calculateSpeedByHeartRate(139, 145, 10)
    expect(newSpeed).toBe(10.1)

    newSpeed = calculateSpeedByHeartRate(151, 145, 10)
    expect(newSpeed).toBe(9.9)
    newSpeed = calculateSpeedByHeartRate(160, 145, 10)
    expect(newSpeed).toBe(9.9)
    newSpeed = calculateSpeedByHeartRate(170, 145, 10)
    expect(newSpeed).toBe(9.8)
    newSpeed = calculateSpeedByHeartRate(180, 145, 10)
    expect(newSpeed).toBe(9.7)
  })

  it('speed is changed heart rate is highly different based on sprints', () => {
    let time = Timespan.parse('02:00')
    let newSpeed = calculateSpeedByHeartRate(70, 145, 10, time)
    expect(newSpeed).toBe(13)
    newSpeed = calculateSpeedByHeartRate(100, 145, 10, time)
    expect(newSpeed).toBe(11.8)
    newSpeed = calculateSpeedByHeartRate(129, 145, 10, time)
    expect(newSpeed).toBe(10.6)

    newSpeed = calculateSpeedByHeartRate(120, 175, 10, time)
    expect(newSpeed).toBe(12.2)
    newSpeed = calculateSpeedByHeartRate(150, 175, 10, time)
    expect(newSpeed).toBe(11)

    time = Timespan.parse("03:00")
    newSpeed = calculateSpeedByHeartRate(120, 175, 10, time)
    expect(newSpeed).toBe(11.9)
    newSpeed = calculateSpeedByHeartRate(150, 175, 10, time)
    expect(newSpeed).toBe(10.9)

    time = Timespan.parse("15:00")
    newSpeed = calculateSpeedByHeartRate(120, 175, 10, time)
    expect(newSpeed).toBe(10.6)
    newSpeed = calculateSpeedByHeartRate(150, 175, 10, time)
    expect(newSpeed).toBe(10.3)
  })

  it('speed is changed based on tempo', () => {
    let newSpeed = calculateSpeedByTempo(Timespan.fromMinutes(5))
    expect(newSpeed).toBe(12)

    newSpeed = calculateSpeedByTempo(Timespan.fromMinutes(5).add(Timespan.fromSeconds(23)))
    expect(newSpeed).toBe(11.1)

    newSpeed = calculateSpeedByTempo(Timespan.fromMinutes(5).add(Timespan.fromSeconds(22)))
    expect(newSpeed).toBe(11.2)

    newSpeed = calculateSpeedByTempo(Timespan.fromMinutes(1))
    expect(newSpeed).toBe(18)

    newSpeed = calculateSpeedByTempo(Timespan.fromMinutes(60))
    expect(newSpeed).toBe(1)

    newSpeed = calculateSpeedByTempo(Timespan.fromMinutes(61))
    expect(newSpeed).toBe(1)
  })
})
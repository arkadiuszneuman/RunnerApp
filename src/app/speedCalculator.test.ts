import { expect, describe, it } from 'vitest'
import { calculateSpeed } from './speedCalculator'

describe('Speed Calculator', () => {
  it('speed is not changed when heart rate is similar to target', () => {
    let newSpeed = calculateSpeed(125, 125, 10)
    expect(newSpeed).toBe(10)
    newSpeed = calculateSpeed(120, 125, 10)
    expect(newSpeed).toBe(10)
    newSpeed = calculateSpeed(130, 125, 10)
    expect(newSpeed).toBe(10)
  })

  it('speed is changed heart rate is highly different', () => {
    let newSpeed = calculateSpeed(70, 145, 10)
    expect(newSpeed).toBe(10.8)
    newSpeed = calculateSpeed(80, 145, 10)
    expect(newSpeed).toBe(10.7)
    newSpeed = calculateSpeed(90, 145, 10)
    expect(newSpeed).toBe(10.6)
    newSpeed = calculateSpeed(100, 145, 10)
    expect(newSpeed).toBe(10.5)
    newSpeed = calculateSpeed(120, 145, 10)
    expect(newSpeed).toBe(10.3)
    newSpeed = calculateSpeed(130, 145, 10)
    expect(newSpeed).toBe(10.2)
    newSpeed = calculateSpeed(139, 145, 10)
    expect(newSpeed).toBe(10.1)

    newSpeed = calculateSpeed(151, 145, 10)
    expect(newSpeed).toBe(9.8)
    newSpeed = calculateSpeed(160, 145, 10)
    expect(newSpeed).toBe(9.4)
    newSpeed = calculateSpeed(170, 145, 10)
    expect(newSpeed).toBe(9)
    newSpeed = calculateSpeed(180, 145, 10)
    expect(newSpeed).toBe(8.6)
  })
})
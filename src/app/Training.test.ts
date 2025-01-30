import { expect, describe, it } from 'vitest'
import Training from './Training'
import { Timespan } from '@/services/Timespan'
import { Stage } from '@/services/stagesCalculator'

describe('Training', () => {
  it('should initialize with given speed', () => {
    const training = new Training(5)
    const result = training.update(120, {
      type: 'simple',
      bmp: 120,
      duration: Timespan.fromMinutes(5),
    }, 1)
    expect(result).toBe(5)
  })

  it('should increase speed when heart rate is too low', () => {
    const training = new Training(5)
    const result = training.update(100, {
      type: 'simple',
      bmp: 140,
      duration: Timespan.fromMinutes(5),
    }, 1)
    expect(result).toBeGreaterThan(5)
  })

  it('should decrease speed when heart rate is too high', () => {
    const training = new Training(5)
    const result = training.update(160, {
      type: 'simple',
      bmp: 140,
      duration: Timespan.fromMinutes(5),
    }, 1)
    expect(result).toBeLessThan(5)
  })

  it('should calculate speed based on tempo', () => {
    const training = new Training(5)
    const result = training.update(120, {
      type: 'simple',
      tempo: Timespan.fromMinutes(5),
      duration: Timespan.fromMinutes(5),
    }, 1)
    expect(result).toBe(12)
  })

  it('should respect minimum speed limit', () => {
    const training = new Training(2)
    const result = training.update(200, {
      type: 'simple',
      bmp: 120,
      duration: Timespan.fromMinutes(5),
    }, 1)
    expect(result).toBeGreaterThanOrEqual(1)
  })

  it('should respect maximum speed limit', () => {
    const training = new Training(17)
    const result = training.update(80, {
      type: 'simple',
      bmp: 180,
      duration: Timespan.fromMinutes(5),
    }, 1)
    expect(result).toBeLessThanOrEqual(18)
  })

  it('real world test', () => {
    const stage: Stage = {
      type: 'simple',
      bmp: 145,
      duration: Timespan.fromMinutes(10),
    }

    const stage2: Stage = {
      type: 'simple',
      bmp: 175,
      duration: Timespan.fromMinutes(2),
    }

    const training = new Training(1)
    let result = training.update(60, stage, 1)
    expect(result).toBe(2.5)

    result = training.update(61, stage, 1)
    expect(result).toBe(3.2)

    result = training.update(61, stage, 1)
    expect(result).toBe(3.9)

    result = training.update(61, stage, 1)
    expect(result).toBe(4.6)

    result = training.update(61, stage, 1)
    expect(result).toBe(5.3)

    result = training.update(61, stage, 1)
    expect(result).toBe(6)

    result = training.update(62, stage, 1)
    expect(result).toBe(6.7)

    result = training.update(63, stage, 1)
    expect(result).toBe(7.4)

    result = training.update(70, stage, 1)
    expect(result).toBe(7.9)

    result = training.update(80, stage, 1)
    expect(result).toBe(8.3)

    result = training.update(100, stage, 1)
    expect(result).toBe(8.5)

    result = training.update(125, stage, 1)
    expect(result).toBe(8.4)

    result = training.update(140, stage, 1)
    expect(result).toBe(8.3)

    result = training.update(145, stage, 1)
    expect(result).toBe(8.3)

    result = training.update(150, stage, 1)
    expect(result).toBe(8.2)

    result = training.update(150, stage, 1)
    expect(result).toBe(8.2)

    result = training.update(160, stage, 1)
    expect(result).toBe(8)

    result = training.update(170, stage, 1)
    expect(result).toBe(7.7)

    result = training.update(170, stage, 1)
    expect(result).toBe(7.5)

    result = training.update(170, stage, 1)
    expect(result).toBe(7.3)

    result = training.update(170, stage, 1)
    expect(result).toBe(7.1)

    result = training.update(165, stage, 1)
    expect(result).toBe(7)

    result = training.update(160, stage, 1)
    expect(result).toBe(6.9)

    result = training.update(155, stage, 1)
    expect(result).toBe(6.9)

    result = training.update(150, stage, 1)
    expect(result).toBe(6.9)

    result = training.update(148, stage, 1)
    expect(result).toBe(6.9)

    result = training.update(145, stage, 1)
    expect(result).toBe(6.9)

    result = training.update(143, stage, 1)
    expect(result).toBe(6.9)

    result = training.update(141, stage, 1)
    expect(result).toBe(6.9)

    result = training.update(139, stage, 1)
    expect(result).toBe(7)

    result = training.update(145, stage, 1)
    expect(result).toBe(6.9)

    result = training.update(145, stage2, 1)
    expect(result).toBe(7.4)

    result = training.update(147, stage2, 1)
    expect(result).toBe(7.6)

    result = training.update(147, stage2, 1)
    expect(result).toBe(7.8)

    result = training.update(147, stage2, 1)
    expect(result).toBe(8)

    result = training.update(150, stage2, 1)
    expect(result).toBe(8.2)

    result = training.update(150, stage2, 1)
    expect(result).toBe(8.4)

    result = training.update(150, stage2, 1)
    expect(result).toBe(8.6)

    result = training.update(150, stage2, 1)
    expect(result).toBe(8.8)

    result = training.update(150, stage2, 1)
    expect(result).toBe(9)

    result = training.update(155, stage2, 1)
    expect(result).toBe(9.1)

    result = training.update(155, stage2, 1)
    expect(result).toBe(9.3)

    result = training.update(157, stage2, 1)
    expect(result).toBe(9.4)
  })
})
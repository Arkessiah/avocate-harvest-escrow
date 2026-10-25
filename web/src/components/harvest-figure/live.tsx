"use client";

import * as React from "react";
import { IsoFigure } from "./kit/draw";
import { asksForStillness, useReadout } from "./kit/live";
import { COINS, LOOP, SLOTS, STILL_TIME, counterText, poseAt, type Pose } from "./model";
import { COUNTER_MATRIX } from "./counter";
import { HEIGHT, WIDTH } from "./view";

const MOST_DT = 1 / 30;
const REST = poseAt(STILL_TIME);

interface Props {
  label: string;
  base: React.ReactNode;
  orchard: React.ReactNode;
  pay: React.ReactNode;
  till: React.ReactNode;
  pool: React.ReactNode;
  poolFront: React.ReactNode;
  pipe: React.ReactNode;
  dispenser: React.ReactNode;
  vault: React.ReactNode;
  feed: React.ReactNode;
  repay: React.ReactNode;
  post: React.ReactNode;
  belts: React.ReactNode;
  crate: React.ReactNode;
  seal: React.ReactNode;
  stamp: React.ReactNode;
  arm: React.ReactNode;
  beltsFront: React.ReactNode;
  dial: React.ReactNode;
  dialHub: React.ReactNode;
  coin: React.ReactNode;
}

const translate = ([x, y]: [number, number]) => `translate(${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100})`;
const opacity = (v: number) => `${Math.round(v * 100) / 100}`;

export function HarvestLive(props: Props) {
  const { anchor, say } = useReadout<HTMLDivElement>();
  const coins = React.useRef<(SVGGElement | null)[]>(Array.from({ length: COINS }, () => null));
  const crate = React.useRef<SVGGElement | null>(null);
  const seal = React.useRef<SVGGElement | null>(null);
  const stamp = React.useRef<SVGGElement | null>(null);
  const needle = React.useRef<SVGPathElement | null>(null);
  const level = React.useRef<SVGPathElement | null>(null);
  const surface = React.useRef<SVGPathElement | null>(null);
  const counter = React.useRef<SVGTextElement | null>(null);
  const root = React.useRef<HTMLDivElement | null>(null);
  const clock = React.useRef(STILL_TIME);
  const lastStep = React.useRef("");
  const [visible, setVisible] = React.useState(false);
  const [paused, setPaused] = React.useState(false);

  const draw = React.useCallback(
    (pose: Pose) => {
      pose.coins.forEach((coin, i) => {
        const node = coins.current[i];
        if (!node) return;
        node.setAttribute("transform", translate(coin.shift));
        node.style.opacity = opacity(coin.opacity);
      });
      if (crate.current) {
        crate.current.setAttribute("transform", translate(pose.crate));
        crate.current.style.opacity = opacity(pose.crateOpacity);
      }
      if (seal.current) seal.current.style.opacity = `${pose.seal}`;
      stamp.current?.setAttribute("transform", translate(pose.stamp));
      needle.current?.setAttribute("d", pose.needle);
      level.current?.setAttribute("d", pose.level);
      surface.current?.setAttribute("d", pose.surface);
      const text = counterText(pose.locked);
      if (counter.current && counter.current.textContent !== text) counter.current.textContent = text;
      if (pose.step !== lastStep.current) {
        lastStep.current = pose.step;
        say(pose.step);
      }
    },
    [say],
  );

  React.useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => setVisible(Boolean(entries.at(-1)?.isIntersecting)), { rootMargin: "80px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible || paused || asksForStillness()) {
      draw(poseAt(asksForStillness() ? STILL_TIME : clock.current));
      return;
    }
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, MOST_DT) : 1 / 60;
      last = now;
      clock.current = (clock.current + dt) % LOOP;
      draw(poseAt(clock.current));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, paused, draw]);

  const coinSlot = (indices: number[]) =>
    indices.map((i) => (
      <g
        key={`coin-${i}`}
        ref={(node) => {
          coins.current[i] = node;
        }}
        transform={translate(REST.coins[i]!.shift)}
        style={{ opacity: REST.coins[i]!.opacity }}
      >
        {props.coin}
      </g>
    ));

  // Painter's order, back to front (larger x and y are nearer the viewer). Each moving
  // part is drawn in the slot where it physically sits: pay coins behind the tank, buy
  // coins on the vault, the crate between the belt and the front rail, the stamp between
  // the crate and the arm.
  return (
    <div
      ref={(node) => {
        root.current = node;
        (anchor as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className="hf-stage"
      role="button"
      tabIndex={0}
      aria-pressed={paused}
      aria-label={paused ? "Animation paused. Press to play the trade again." : "Animation playing. Press to pause it."}
      onClick={() => setPaused((p) => !p)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          setPaused((p) => !p);
        }
      }}
    >
      <IsoFigure width={WIDTH} height={HEIGHT} label={props.label}>
        {props.base}
        {props.dispenser}
        {props.vault}
        <text ref={counter} className="hf-counter" transform={COUNTER_MATRIX} fontSize={6}>
          {counterText(REST.locked)}
        </text>
        {props.feed}
        {coinSlot(SLOTS.buy)}
        {props.pay}
        {props.till}
        {coinSlot(SLOTS.pay)}
        {props.pool}
        <path ref={level} className="hf-level" d={REST.level} />
        <path ref={surface} className="iso-line" data-tone="lit" d={REST.surface} />
        {props.poolFront}
        {props.pipe}
        {coinSlot(SLOTS.advance)}
        {props.repay}
        {coinSlot(SLOTS.repay)}
        {props.orchard}
        {props.post}
        {props.belts}
        <g ref={crate} transform={translate(REST.crate)} style={{ opacity: REST.crateOpacity }}>
          {props.crate}
          <g ref={seal} style={{ opacity: REST.seal }}>
            {props.seal}
          </g>
        </g>
        <g ref={stamp} transform={translate(REST.stamp)}>
          {props.stamp}
        </g>
        {props.arm}
        {props.beltsFront}
        {props.dial}
        <path ref={needle} className="iso-line hf-needle" data-tone="hi" data-free="end" d={REST.needle} />
        {props.dialHub}
      </IsoFigure>
    </div>
  );
}

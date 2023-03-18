import { Collection, Feature, Map as olMap, View } from "ol";
import { Attribution } from "ol/control";
import { click } from "ol/events/condition";
import { extend } from "ol/extent";
import { FeatureLike } from "ol/Feature";
import { GeoJSON } from "ol/format";
import { Geometry, Point } from "ol/geom";
import { defaults, Select } from "ol/interaction";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import "ol/ol.css";
import { fromLonLat, useGeographic } from "ol/proj.js";
import { OSM, Vector as VectorSource } from "ol/source";
import { Circle, Fill, Stroke, Style, Text } from "ol/style";
import { createSignal, For, onMount, Show } from "solid-js";
import * as z from "zod";
import logoAD from "./assets/logoAD.png";
import { Colors, GodElement, TownMetadata, townMetadata, townScore, TownScore } from "./types";

useGeographic();

let map: olMap;
let scores: TownScore[];
const pointsFeatures = new Collection<Feature<Point>>();
const textFeatures = new Collection<Feature<Point>>();
const outlineFeatures = new Collection<Feature<Geometry>>();

const duration = 1000;
const franceExtent = [-5.475866, 41.21611, 9.87586, 51.47943];
const GeoJsonParser = new GeoJSON();

let godObject = new Map<string, GodElement>();
let godObjectKeys: string[];

window.godObject = godObject;

const replacements = new Map<string, string>([
	["Le Puy en Velay", "Le Puy-en-Velay"],
	["Dôle", "Dole"],
	["Epinal", "Épinal"],
	["Aix-En-Provence", "Aix-en-Provence"],
	["Angoulème", "Angoulême"],
	["Les sables-d'Olonne", "Les Sables-d'Olonne"],
	["Evreux", "Évreux"],
	["Saint-Etienne", "Saint-Étienne"],
	["Fort-De-France", "Fort-de-France"],
	["Cherbourg", "Cherbourg-en-Cotentin"],
	["Saint-Denis de la Réunion", "Saint-Denis"],
]);

const reverseReplacements = new Map<string, string>(
	Array.from(replacements.entries()).map(([k, v]) => [v, k])
);

const getInseeName = (name: string) => replacements.get(name) ?? name;

const getScoreName = (name: string) => reverseReplacements.get(name) ?? name;

const [matchingTowns, setMatchingTowns] = createSignal<GodElement[]>([]);
const [searchBarValue, setSearchBarValue] = createSignal("");
const [currentTown, setCurrentTown] = createSignal<string | null>(null);

export default function App() {
	onMount(async () => {
		map = initializeMap();
		const townsJson = await fetch("https://api.cityrank.clockworks.fr/cities");
		scores = z.array(townScore).parse(await townsJson.json());
		await fetchFeatures();
		godObjectKeys = Array.from(godObject.keys());
	});

	return (
		<div class="flex h-screen flex-col bg-ad">
			{new URLSearchParams(window.location.search).get("hideNavbar") !== "true" && (
				<div class="z-10 hidden flex-wrap items-center justify-center p-4 shadow-2xl tall:flex">
					<img src={logoAD} class="mx-2 h-10 rounded-full" />
					<span class="mx-2 hidden text-2xl font-bold leading-normal text-amber-500 md:block">
						Classement&nbsp;Officiel et&nbsp;Scientifique
						des&nbsp;Villes&nbsp;de&nbsp;France
					</span>
				</div>
			)}
			<div class="relative flex flex-1">
				<div id="map" class="flex-1" />
				<Show when={!currentTown()}>
					<div
						class="absolute right-0 top-0 left-0 z-10 m-5 flex flex-col bg-amber-800 bg-transparent sm:left-auto sm:w-96"
						id="sidebar"
					>
						<SearchBar />
					</div>
				</Show>

				<Show when={currentTown()}>
					<div
						class="absolute bottom-0 top-0 right-0 left-0 z-10 flex flex-col overflow-y-auto bg-amber-800 bg-opacity-50 p-5 backdrop-blur-sm sm:left-auto sm:w-[26.5rem]"
						id="sidebar"
					>
						<SearchBar />
						<Stats />
						{/* "bottom-0", "bg-opacity-50", "p-5", "backdrop-blur-sm" */}
					</div>
				</Show>
			</div>
			<SponsorMe />
		</div>
	);
}

function SponsorMe() {
	// This is the iframe to embed

	return (
		<div class="m-1 flex flex-row flex-wrap items-center justify-end p-1 shadow-2xl">
			<a
				href="https://github.com/sponsors/pilatte"
				target="_blank"
				rel="noreferrer"
				class="text-lg font-bold leading-normal text-amber-500"
			>
				<span class="hidden sm:inline-block">Soutenez moi sur Github</span> @pilatte
				<img
					src="https://avatars.githubusercontent.com/u/34147102?s=40&u=501359a7ec40a19eabab63fee7edf67bdedc8859&v=4"
					alt="Sponsor pilatte"
					height="32"
					width="32"
					class="mx-2 inline-block rounded-full border-2 border-amber-500 align-middle"
				/>
			</a>
			<iframe
				src="https://github.com/sponsors/pilatte/button"
				title="Sponsor pilatte"
				height="32"
				width="114"
				class=" inline-block rounded-lg border-0"
			></iframe>
		</div>
	);
}

function Stats() {
	const town = godObject.get(currentTown() ?? "");
	if (!town) {
		console.error("Town not found", currentTown());
		return null;
	}
	// Return a grid of stats
	// The name is right aligned
	// The value is left aligned
	return (
		<>
			<img
				src={town.score.imageUrl}
				class=" mt-5 flex w-full rounded-lg border-2 border-amber-500 object-cover"
			/>
			{/* <div class="mt-5 flex h-fit w-full flex-shrink rounded-lg border-2 border-amber-500 object-cover"></div> */}
			<div class="mt-5 grid grid-cols-2 gap-1 rounded-lg border-2 border-amber-500 bg-amber-700 p-5 text-xl  text-white">
				<div>Nom</div>
				<div>
					<b>{town.metadata.com_name}</b>
				</div>
				<div>Département</div>
				<div>
					<b>{town.metadata.dep_name}</b>
				</div>
				<div>Région</div>
				<div>
					<b>{town.metadata.reg_name}</b>
				</div>
				<div>À vivre</div>
				<div>
					<b>{town.score.toLive}</b> /20
				</div>
				<div>Culture</div>
				<div>
					<b>{town.score.cultural}</b> /20
				</div>
				<div>Histoire</div>
				<div>
					<b>{town.score.history}</b> /20
				</div>
				<div>Vibe</div>
				<div>
					<b>{town.score.vibe}</b> /20
				</div>
				<div>Score Total</div>
				<div>
					<b>{town.score.total}</b> /80
				</div>
			</div>
		</>
	);
}

function SearchBar() {
	return (
		<>
			<div class="relative ">
				<input
					type="text"
					onChange={(e) => search(e.currentTarget?.value ?? "")}
					id="searchBar"
					value={searchBarValue()}
					placeholder="Rechercher une ville..."
					onInput={(e) => setMatchingTowns(Array.from(filter(e.currentTarget.value)))}
					class="w-full rounded-lg  border-2 border-amber-500 bg-amber-700 px-2 py-1 text-2xl font-bold text-white outline-none placeholder:text-amber-500 "
				/>
				<button
					onClick={() => setSearchBar("")}
					class="clear-button absolute top-0 right-0 p-2.5 text-amber-500 hover:text-white"
				>
					<svg viewBox="0 0 20 20" fill="currentColor" class="x-circle h-6 w-6">
						<path
							fill-rule="evenodd"
							d="M10 18A8 8 0 102 10a8 8 0 008 8zm1.41-10l3.3-3.29a1 1 0 10-1.42-1.42L10 8.59 6.71 5.29a1 1 0 00-1.42 1.42L8.59 10l-3.3 3.29a1 1 0 101.42 1.42L10 11.41l3.29 3.3a1 1 0 001.42-1.42L11.41 10z"
							clip-rule="evenodd"
						/>
					</svg>
				</button>
			</div>
			<div
				class="z-10 mx-2 grid max-h-[75vh] overflow-auto rounded-b-lg bg-ad"
				id="searchResults"
			>
				<For each={matchingTowns()}>
					{(e) => (
						<div
							class="search-suggestion border-b-[1px] border-amber-400 px-2 py-2 text-amber-400 hover:bg-amber-900 sm:py-1"
							onClick={() => setSearchBar(e.metadata.com_name)}
						>
							{e.metadata.com_name}
						</div>
					)}
				</For>
			</div>
		</>
	);
}

function setSearchBar(str: string) {
	setSearchBarValue(str);
	setMatchingTowns([]);
	search(str);
	(document.getElementById("searchBar") as HTMLInputElement).value = str;
}

// async function search(e: Event) {
// 	const town = (e.target as HTMLInputElement)?.value ?? "";
// 	// Begin fetching data (async function)
// 	const townOutlinePromise = getTownOutlineCached(town, searchExactMatch());
// 	const outView = new View();
// 	const destinationCoordinates = pointsFeatures
// 		.getArray()
// 		.find((f) => f.get("name") === town)
// 		?.getGeometry()!
// 		.getCoordinates();
// 	const destinationExtent = destinationCoordinates
// 		? new Point(destinationCoordinates).getExtent()
// 		: franceExtent;
// 	outView.fit(extend(map.getView().calculateExtent(map.getSize()!), destinationExtent), {
// 		padding,
// 		size: map.getSize(),
// 	});
// 	const zoomOutDuration =
// 		Math.abs((map.getView().getZoom() ?? 0) - (outView.getZoom() ?? 0)) * 100 + 200;

// 	map.getView().animate(
// 		// Start animating outward while fetching data
// 		{
// 			center: outView.getCenter(),
// 			zoom: outView.getZoom(),
// 			duration: zoomOutDuration,
// 		},
// 		() => {
// 			townOutlinePromise.then((features) => {
// 				// When data is fetched, animate inward on the destination town
// 				if (!features.length && !destinationCoordinates) return;
// 				//throw new Error(`No features found for ${town}`);
// 				const destinationView = new View();
// 				let extent = destinationCoordinates
// 					? destinationExtent
// 					: features[0].getGeometry()!.getExtent();
// 				features.forEach((feature) => {
// 					extent = extend(extent, feature.getGeometry()!.getExtent());
// 				});
// 				destinationView.fit(extent, {
// 					padding,
// 					size: map.getSize(),
// 				});
// 				map.getView().animate({
// 					center: destinationView.getCenter(),
// 					zoom: features.length ? destinationView.getZoom() : 12,
// 					duration,
// 				});
// 			});
// 		}
// 	);
// }

function* filter(text: string) {
	// if (!text) return;
	for (const element of godObject.values()) {
		if (
			element.metadata.com_name.toLowerCase().startsWith(text.toLowerCase()) ||
			element.score.name.toLowerCase().startsWith(text.toLowerCase()) ||
			element.metadata.com_code.toLowerCase().startsWith(text.toLowerCase())
		) {
			yield element;
		}
	}
}

async function search(e: string) {
	setSearchBarValue(e);
	if (!e || !godObject.has(e)) {
		setCurrentTown(null);
		return;
	}
	const town = godObject.get(e)!;
	setCurrentTown(town.metadata.com_name);
	const padding = [50, 50 + 384, 50, 50];
	const outView = new View();
	let extent = town.point.getGeometry()!.getExtent();
	outView.fit(extend(map.getView().calculateExtent(map.getSize()!), extent), {
		padding,
		size: map.getSize(),
	});
	const destView = new View();
	town.outline.forEach((feature) => {
		extent = extend(extent, feature.getGeometry()!.getExtent());
	});
	destView.fit(extent, { padding, size: map.getSize() });
	const zoomOutDuration =
		Math.abs((map.getView().getZoom() ?? 0) - (outView.getZoom() ?? 0)) * 100 + 200;

	map.getView().animate(
		{
			center: outView.getCenter(),
			zoom: outView.getZoom(),
			duration: zoomOutDuration,
		},
		{
			center: destView.getCenter(),
			zoom: destView.getZoom()! > 20 ? 13 : destView.getZoom(),
			duration: 500,
		}
	);
}

function initializeMap() {
	const map = new olMap({
		target: "map",
		controls: [
			new Attribution({
				collapsible: false,
			}),
		],
		layers: [
			new TileLayer({
				source: new OSM(),
				zIndex: 0,
			}),
			new VectorLayer({
				source: new VectorSource({ features: outlineFeatures }),
				minZoom: 8,
				zIndex: 1,
			}),

			new VectorLayer({
				source: new VectorSource({ features: textFeatures }),
				minZoom: 6,
				zIndex: 2,
			}),
			new VectorLayer({
				source: new VectorSource({ features: pointsFeatures }),
				maxZoom: 6,
				zIndex: 3,
			}),
			new VectorLayer({
				source: new VectorSource({
					attributions: "@pilatte",
				}),
			}),
		],
		interactions: defaults().extend([getSelect()]),
	});
	map.getView().fit(franceExtent, { padding: [50, 50, 50, 50] });
	return (window.map = map);
}

function getSelect() {
	const select = new Select({ multi: false, condition: click, style: null });
	select.on("select", (e) => {
		setSearchBar(askGod(e.selected[0])?.metadata.com_name ?? "");
	});
	return select;
}

async function fetchFeatures() {
	const townsResponse = await fetch("/towns.json");
	const townsRaw = await townsResponse.json();
	const towns = z.array(townMetadata).parse(townsRaw);

	await Promise.all(
		towns.map(async (town) => {
			const score = scores.find((score) => getScoreName(town.com_name) == score.name);
			if (!score) {
				throw new Error(`No score found for ${town.com_name}`);
			}
			godObject.set(town.com_name, {
				metadata: town,
				score: score,
				outline: await setOutlineFeature(town, score),
				point: await setPointFeature(town, score),
				text: await setTextFeature(town, score),
				colors: getColors(score.total),
			});
		})
	);
	setMatchingTowns(Array.from(godObject.values()));
}

async function setPointFeature(town: TownMetadata, score: TownScore) {
	const feature = new Feature({
		geometry: new Point([town.geo_point_2d[1], town.geo_point_2d[0]]),
	});
	feature.set("ref", town.com_name);
	feature.setStyle(
		new Style({
			image: new Circle({
				radius: 5,
				fill: new Fill({ color: getColors(score.total).dot }),
			}),
		})
	);
	pointsFeatures.push(feature);
	return feature;
}

async function setTextFeature(town: TownMetadata, score: TownScore) {
	const feature = new Feature({
		geometry: new Point([town.geo_point_2d[1], town.geo_point_2d[0]]),
	});
	feature.set("ref", town.com_name);
	const colors = getColors(score.total);
	feature.setStyle(
		new Style({
			image: new Circle({
				radius: 15,
				fill: new Fill({ color: colors.fill }),
				// stroke: new Stroke({ color: "#ff3333", width: 2 }),
			}),
			text: new Text({
				text: score.total.toString() || "",
				font: "16px Calibri,sans-serif",
				fill: new Fill({ color: "#fff" }),
				stroke: new Stroke({ color: colors.stroke, width: 5 }),
			}),
		})
	);
	textFeatures.push(feature);
	return feature;
}

async function setOutlineFeature(town: TownMetadata, score: TownScore) {
	const response = await fetch(`/towns/${encodeURIComponent(town.com_name)}.json`);
	const features = GeoJsonParser.readFeatures(await response.json());

	const colors = getColors(score.total);

	features.forEach((feature) => {
		feature.set("ref", town.com_name);
		feature.setStyle(
			new Style({
				fill: new Fill({ color: colors.polygon }),
				stroke: new Stroke({ color: colors.edge, width: 3 }),
			})
		);
	});

	if (!features.length) console.warn("No outline found for " + town.com_name);
	outlineFeatures.extend(features);
	return features;
}

function askGod(feature: FeatureLike) {
	return godObject.get(feature.get("ref"));
}

function getColors(score: number): Colors {
	let scoreHue: number = score * 4.5 - 150;

	const opacityBoost = score / 200;
	const colors =
		score == 0
			? ({
					fill: "rgba(100, 100, 100, 0.2)",
					stroke: "#aaa",
					text: "#333",
					dot: "rgba(100, 100, 100, 0.6)",
					polygon: "rgba(100, 100, 100, 0.1)",
					edge: "rgba(0, 0, 0, 0.4)",
			  } as const)
			: ({
					fill: `hsla(${scoreHue}, 100%, 50%, ${0.2 + opacityBoost})`,
					stroke: `hsla(${scoreHue}, 100%, 20%, 1)`,
					text: `hsla(${scoreHue}, 100%, 90%, 1)`,
					dot: `hsla(${scoreHue}, 100%, 40%, 1)`,
					polygon: `hsla(${scoreHue}, 100%, 50%, ${(0.2 + opacityBoost) / 3})`,
					edge: `hsla(${scoreHue}, 100%, 30%, 0.8)`,
			  } as const);
	return colors;
}

// function getTownOutlineUpstream(
// 	town: string,
// 	searchExactMatch: boolean
// ): Promise<Feature<Geometry>[]> {
// 	return new Promise((resolve, reject) => {
// 		// const params = { dataset: "georef-france-commune", q: `refine.com_name=${town}` };
// 		// const url = new URL("https://public.opendatasoft.com/api/records/1.0/search/");
// 		// url.search = new URLSearchParams(params).toString();
// 		const url =
// 			"https://public.opendatasoft.com" +
// 			"/api/records/1.0/search/?dataset=georef-france-commune&q=" +
// 			(searchExactMatch ? "&refine.com_name=" : "com_name=") +
// 			encodeURIComponent(town);

// 		fetch(url.toString())
// 			.then((response) => response.json())
// 			.then((data) => {
// 				resolve(parseFeatures(data));
// 			});
// 	});
// }

// async function getTownOutlineServer(
// 	town: string,
// 	searchExactMatch: boolean
// ): Promise<Feature<Geometry>[]> {
// 	const parser = new GeoJSON();
// 	const path = "/cities/" + encodeURIComponent(town) + ".json";
// 	const response = await fetch(path);
// 	if (!response.ok) {
// 		throw new Error("Not found");
// 	}
// 	const data = await response.json();
// 	return parser.readFeatures(data);
// }

// const cache = new Map<string, Feature<Geometry>[]>();
// async function getTownOutlineCached(
// 	town: string,
// 	searchExactMatch: boolean
// ): Promise<Feature<Geometry>[]> {
// 	const key = town;
// 	if (searchExactMatch && cache.has(key)) return cache.get(key)!;
// 	let features: Feature<Geometry>[];
// 	try {
// 		features = await getTownOutlineServer(town, searchExactMatch);
// 		if (searchExactMatch) {
// 			cache.set(key, features);
// 			outlineFeatures.extend(features);
// 		}
// 	} catch (e) {
// 		console.log("Not found in cache, trying upstream");
// 		features = await getTownOutlineUpstream(town, searchExactMatch);
// 	}
// 	return features;
// }

// function parseFeatures(data: any): Feature<Geometry>[] {
// 	const geojsonFormat = new GeoJSON();
// 	return geojsonFormat.readFeatures({
// 		type: "FeatureCollection",
// 		features: data.records.map((record: any) => record.fields.geo_shape) ?? [],
// 	});
// }

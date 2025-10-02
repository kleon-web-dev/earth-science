import React, { createContext, useContext, useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, SelectiveBloom, Select } from "@react-three/postprocessing";
import * as THREE from "three";

// ==============================
// CONTEXT API
// ==============================

// Creiamo il context per gestire lo stato condiviso
const EarthContext = createContext();

const EarthProvider = ({ children }) => {
  // Stato condiviso tra i componenti
  const [isExplore, setIsExplore] = useState(false);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [clipped, setClipped] = useState(false);
  const [rotate, setRotate] = useState(true);

  return (
    <EarthContext.Provider
      value={{
        isExplore,
        setIsExplore,
        currentLayer,
        setCurrentLayer,
        clipped,
        setClipped,
        rotate,
        setRotate,
      }}
    >
      {children}
    </EarthContext.Provider>
  );
};

// Hook custom per accedere facilmente al contesto
const useEarth = () => useContext(EarthContext);

// ==============================
// COMPONENTE EARTHLAYERS
// ==============================

const createRadialGradient = () => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Creazione del gradiente radiale
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    10,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "#ffffff"); // Bianco al centro per l'incandescenza
  gradient.addColorStop(0.5, "#ff8800"); // Arancione caldo
  gradient.addColorStop(0.8, "#ffffff"); // Aggiunge bianco dietro il rosso
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Creazione della texture Three.js
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true; // Assicura che la texture venga aggiornata

  return texture;
};

const EarthLayers = () => {
  // Stato locale per i colori
  const layerColor = {
    outerCore: "#ffb300",
    innerCore: "#ffdd63",
    innerCrust: "saddlebrown",
    innerMantle: "#c45f00",
    outerMantle: "#992b00",
  };

  // Stato gestito tramite il Context
  const {
    isExplore,
    setIsExplore,
    currentLayer,
    setCurrentLayer,
    clipped,
    setClipped,
    rotate,
    setRotate,
  } = useEarth();

  const layers = [
    { name: "innerOrbit", value: 0, clipping: 0 },
    { name: "outerOrbit", value: 1, clipping: 2.7 },
    { name: "innerMantle", value: 2, clipping: 3.7 },
    { name: "outerMantle", value: 3, clipping: 3.5 },
    { name: "innerCrust", value: 4, clipping: 3.5 },
  ];

  const earthTexture = useLoader(THREE.TextureLoader, `${process.env.PUBLIC_URL}/8081_earthmap10k.jpg`);
  const radialGradientTexture = useMemo(() => createRadialGradient(), []);
  const clippingPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(1, 0, 0), layers[currentLayer].clipping),
    [currentLayer, layers]
  );

  const getMaterial = (color, texture = null) => (
    <meshStandardMaterial
      map={texture || null}
      color={texture ? null : color}
      transparent={false}
      opacity={1}
      side={THREE.DoubleSide}
      clippingPlanes={clipped ? [clippingPlane] : []} // Usa il piano di taglio se clipped è true
      emissive="black"
      emissiveIntensity={0}
    />
  );

  // Gestione degli eventi da tastiera
  useEffect(() => {
    const handleKeyPress = (event) => {
      switch (event.key) {
        case "Enter":
          // Se isExplore è false, toggle dei flag
          if (!isExplore) {
            setClipped((prev) => !prev);
            setRotate((prev) => !prev);
          }
          break;
        case "g":
          setRotate((prev) => !prev);
          break;
        case "e":
          setIsExplore((prev) => !prev);
          break;
          case "ArrowRight":
            event.preventDefault();
            setCurrentLayer((prev) => (prev < layers.length - 1 ? prev + 1 : prev));
            break;
          case "ArrowLeft":
            event.preventDefault();
            setCurrentLayer((prev) => (prev > 0 ? prev - 1 : prev));
            break;
          
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isExplore, setClipped, setRotate, setIsExplore, setCurrentLayer, layers, clipped]);

  // Effetto per sincronizzare lo stato di clipping quando isExplore è attivo
  useEffect(() => {
    if (isExplore) {
      setClipped(true);
    }
  }, [isExplore, setClipped]);

  const earthRef = useRef();

  useFrame(() => {
    if (rotate && !clipped && earthRef.current) {
      earthRef.current.rotation.y -= 0.005;
    }
  });

  return (
    <group>
      {/* Terra con texture */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[5, 64, 64]} />
        {getMaterial(null, earthTexture)}
      </mesh>

      {/* Crosta Terrestre */}
      <mesh>
        <sphereGeometry args={[4.99, 64, 64]} />
        <meshStandardMaterial
          clippingPlanes={currentLayer === 4 ? [] : [clippingPlane]} // Usa il piano di taglio se clipped è true
          side={THREE.DoubleSide}
          color={layerColor.innerCrust}
        />
      </mesh>

      {/* Mantello Esterno */}
      <mesh>
        <sphereGeometry args={[4.8, 64, 64]} />
        <meshStandardMaterial
          clippingPlanes={currentLayer === 3 ? [] : [clippingPlane]} // Usa il piano di taglio se clipped è true
          side={THREE.DoubleSide}
          color={layerColor.outerMantle}
        />
      </mesh>

      {/* Mantello Interno */}
      <mesh>
        <sphereGeometry args={[3.7, 64, 64]} />
        {getMaterial(layerColor.innerMantle)}
      </mesh>

      {/* Nucleo Esterno */}
      <mesh>
        <sphereGeometry args={[2.7, 64, 64]} />
        {getMaterial(layerColor.outerCore)}
      </mesh>

      <Select enabled>
        <mesh rotation={[15, 10, 0]}>
          <sphereGeometry args={[0.8, 64, 64]} />
          <meshStandardMaterial
            emissive="red"
            emissiveIntensity={4}
            map={radialGradientTexture}
          />
        </mesh>
      </Select>
    </group>
  );
};

// ==============================
// COMPONENTI THREE SCENE & SCENECONTENT
// ==============================

const SceneContent = () => {
  // Accesso al contesto per ottenere variabili condivise
  const { isExplore, currentLayer } = useEarth();
  const description = [
    {name: "Nucleo Interno", description: "Il nucleo interno è una sfera solida, principalmente composta da ferro e nichel. Nonostante le temperature che superano i 5.000°C, la pressione estrema impedisce che i metalli si fondano, mantenendo questo strato in uno stato solido. Questo nucleo solido gioca un ruolo fondamentale nel generare il campo magnetico terrestre, grazie al movimento relativo tra il nucleo interno e quello esterno, creando un sistema di dinamo che protegge la Terra dalle radiazioni solari."}
    , {
      name: "Nucleo Esterno", description: "Il nucleo esterno è una regione liquida, composta da ferro e nichel fusi, con temperature che vanno dai 4.000°C ai 5.000°C. La sua alta temperatura e densità causano il movimento di materiali fusi che generano correnti di convezione. Queste correnti, insieme alla rotazione della Terra, sono la causa principale della generazione del campo magnetico terrestre, un fenomeno vitale per la protezione del pianeta dalle radiazioni cosmiche e solari."
    },
    {
      name: "Mantello Inferiore", description: "Il mantello inferiore è una zona solida ma plastica, composta principalmente da peridotite. A temperature tra i 3.000°C e i 4.000°C, i materiali di questo strato sono abbastanza caldi da deformarsi lentamente, ma abbastanza rigidi da non fondersi. La sua viscosità consente ai materiali di muoversi molto lentamente, contribuendo al processo di convezione che spinge la crosta terrestre e influenza la tettonica delle placche. Questo movimento è essenziale per la creazione di montagne, terremoti e la formazione di vulcani."
    },
    {
      name: "Mantello Superiore", description: "Il mantello superiore è simile al mantello inferiore, ma più rigido. È costituito principalmente da peridotite e si estende fino alla crosta terrestre. Nonostante la sua struttura solida, è influenzato dal movimento dei materiali nella parte inferiore, che causa la tettonica delle placche e il movimento delle placche lithosferiche. La sua composizione e il comportamento viscoelastico permettono la formazione di fenomeni come il sollevamento di catene montuose e la creazione di nuovi fondali oceanici."
    },
    {
      name: "Crosta Terrestre", description: `Oceanica: La crosta oceanica è più sottile (5-10 km) e composta principalmente da basalto, una roccia magmatica ricca di ferro e magnesio. È più densa rispetto alla crosta continentale e tende a subire subduzione nei punti di incontro con quest'ultima.

Crosta Continentale: La crosta continentale è molto più spessa (30-70 km) e composta principalmente da granito, una roccia ricca di silicio e alluminio. È meno densa rispetto alla crosta oceanica e più vecchia, con alcune zone che risalgono a oltre 4 miliardi di anni fa.

Interazione tra le croste: Questi strati interagiscono nel ciclo delle placche tettoniche, causando fenomeni come terremoti, eruzioni vulcaniche e la formazione di catene montuose, guidati dal calore interno della Terra. La comprensione di questi processi è fondamentale per la geologia e la previsione dei disastri naturali.`
    }
  ]
  return (
    <>
    <div style={{background: "#F0F0F0", textAlign: "center", fontSize: "50px", paddingTop: "10px", fontFamily: "sans-serif"}}>La Terra</div>
      <div id="container">
      
        <Canvas
          gl={{ localClippingEnabled: true }}
          camera={{ position: [10, 0, 0] }}
          style={{ width: "80%", height: "80vh", margin: "auto" }}
        >
          <ambientLight intensity={2} />
          <directionalLight position={[5, 5, 5]} intensity={3} />
          <directionalLight position={[-5, -5, -5]} intensity={2} />

          <EarthLayers />

          <OrbitControls
            minDistance={7}
            maxDistance={15}
            target={[0, 0, 0]}
            enableZoom
            enablePan={false}
            maxPolarAngle={Math.PI}
            enableRotate
          />

<EffectComposer>
            <SelectiveBloom luminanceThreshold={0} luminanceSmoothing={0.9} intensity={4} />
          </EffectComposer>
        </Canvas>

        
        {isExplore && (
          <div className="container-description">
            <div>
            <h1>
            {description[currentLayer].name}

            </h1>
            <div>{description[currentLayer].description}</div>
            </div>
            
          </div>
        )}
      </div>
      <div>
        <p>
          Controlli: 
          <br /> - "Enter" per abilitare/disabilitare il taglio (se non in esplorazione)
          <br /> - "g" per abilitare/disabilitare la rotazione
          <br /> - "e" per la modalità esplorazione
          <br /> - "Freccia destra" per passare al livello successivo
          <br /> - "Freccia sinistra" per passare al livello precedente <br/><br/>
          <br/>Tutti i diritti riservati  Kleon Arapaj © Copyright 2024
          <br/><br/><br/><br/><br/><br/>
        </p>
      </div>
    </>
  );
};

const ThreeScene = () => {
  return (
    // Wrappa tutto il contenuto con il provider in modo che
    // i componenti possano accedere agli stati condivisi
    <EarthProvider>
      <SceneContent />
    </EarthProvider>
  );
};

export default ThreeScene;

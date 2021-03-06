// @flow
import * as React from 'react';
import LoadingScreen from 'component/common/loading-screen';
// ThreeJS
import * as THREE from './internal/three';
import detectWebGL from './internal/detector';
import ThreeGrid from './internal/grid';
import ThreeScene from './internal/scene';
import ThreeLoader from './internal/loader';
import ThreeRenderer from './internal/renderer';

type Props = {
  theme: string,
  autoRotate: boolean,
  source: {
    fileType: string,
    downloadPath: string,
  },
};

class ThreeViewer extends React.PureComponent<Props> {
  constructor(props: Props) {
    super(props);

    const { theme } = this.props;

    // Main container
    this.viewer = React.createRef();

    // Object colors
    this.materialColors = {
      red: '#e74c3c',
      blue: '#3498db',
      green: '#44b098',
      orange: '#f39c12',
    };

    // Viewer themes
    this.themes = {
      dark: {
        gridColor: '#414e5c',
        groundColor: '#13233C',
        backgroundColor: '#13233C',
        centerLineColor: '#7f8c8d',
      },
      light: {
        gridColor: '#7f8c8d',
        groundColor: '#DDD',
        backgroundColor: '#EEE',
        centerLineColor: '#2F2F2F',
      },
    };

    // Select current theme
    this.theme = this.themes[theme] || this.themes.light;

    // State
    this.state = {
      error: null,
      isReady: false,
      isLoading: false,
    };
  }

  componentDidMount() {
    if (detectWebGL()) {
      this.renderScene();
      // Update render on resize window
      window.addEventListener('resize', this.handleResize, false);
    } else {
      // No webgl support, handle Error...
      // TODO: Use a better error message
      this.setState({ error: "Sorry, your computer doesn't support WebGL." });
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize, false);
  }

  transformGroup(group) {
    this.fitMeshToCamera(group);
    this.createWireFrame(group);
    this.updateControlsTarget(group.position);
  }

  createOrbitControls(camera, canvas) {
    const { autoRotate } = this.props;
    const controls = new THREE.OrbitControls(camera, canvas);
    // Controls configuration
    controls.enableDamping = true;
    controls.dampingFactor = 0.75;
    controls.enableZoom = true;
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.autoRotate = autoRotate;
    controls.enablePan = false;
    return controls;
  }

  createGeometry(data) {
    const geometry = new THREE.Geometry();
    geometry.fromBufferGeometry(data);
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
    geometry.center();
    geometry.rotateX(-Math.PI / 2);
    geometry.lookAt(new THREE.Vector3(0, 0, 1));
    return geometry;
  }

  createWireFrame(group) {
    const wireframeGeometry = new THREE.WireframeGeometry(group.geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({
      opacity: 0,
      transparent: true,
      linewidth: 1,
    });
    // Set material color
    wireframeMaterial.color.set(this.materialColors.green);
    this.wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    group.add(this.wireframe);
  }

  toggleWireFrame(show = false) {
    this.wireframe.opacity = show ? 1 : 0;
    this.mesh.material.opacity = show ? 0 : 1;
  }

  fitMeshToCamera(group) {
    const max = { x: 0, y: 0, z: 0 };
    const min = { x: 0, y: 0, z: 0 };

    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const box = new THREE.Box3().setFromObject(child);
        // Max
        max.x = box.max.x > max.x ? box.max.x : max.x;
        max.y = box.max.y > max.y ? box.max.y : max.y;
        max.z = box.max.z > max.z ? box.max.z : max.z;
        // Min
        min.x = box.min.x < min.x ? box.min.x : min.x;
        min.y = box.min.y < min.y ? box.min.y : min.y;
        min.z = box.min.z < min.z ? box.min.z : min.z;
      }
    });

    const meshY = Math.abs(max.y - min.y);
    const meshX = Math.abs(max.x - min.x);

    const scaleFactor = 10 / Math.max(meshX, meshY);

    group.scale.set(scaleFactor, scaleFactor, scaleFactor);
    group.position.setY((meshY / 2) * scaleFactor);

    // Reset object position
    const box = new THREE.Box3().setFromObject(group);
    box.getCenter(group.position);

    group.position.multiplyScalar(-1);
    group.position.setY(group.position.y + meshY * scaleFactor);
  }

  startLoader() {
    const { source } = this.props;

    if (source) {
      ThreeLoader(source, this.renderModel.bind(this), {
        onStart: this.handleStart,
        onLoad: this.handleReady,
        onError: this.handleError,
      });
    }
  }

  handleStart = () => {
    this.setState({ isLoading: true });
  };

  handleReady = () => {
    this.setState({ isReady: true, isLoading: false });
  };

  handleError = () => {
    this.setState({ error: "Sorry, looks like we can't load this file" });
  };

  handleResize = () => {
    const { offsetWidth: width, offsetHeight: height } = this.viewer.current;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.renderer.setSize(width, height);
  };

  handleColorChange(color) {
    if (!this.mesh) return;
    const pickColor = this.materialColors[color] || this.materialColors.green;
    this.mesh.material.color.set(pickColor);
    this.wireframe.material.color.set(pickColor);
  }

  updateControlsTarget(point) {
    this.controls.target.fromArray([point.x, point.y, point.z]);
    this.controls.update();
  }

  renderStl(data) {
    const geometry = this.createGeometry(data);
    const group = new THREE.Mesh(geometry, this.material);
    // Assign name
    group.name = 'objectGroup';
    this.scene.add(group);
    this.transformGroup(group);
    this.mesh = group;
  }

  renderObj(event) {
    const mesh = event.detail.loaderRootNode;
    const group = new THREE.Group();
    group.name = 'objGroup';

    // Assign new material
    mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        // Get geometry from child
        const geometry = new THREE.Geometry();
        geometry.fromBufferGeometry(child.geometry);
        // Create and regroup inner objects
        const innerObj = new THREE.Mesh(geometry, this.material);
        group.add(innerObj);
      }
    });

    this.scene.add(group);
    this.transformGroup(group);
    this.mesh = group;
  }

  renderModel(fileType, parsedData) {
    const renderTypes = {
      stl: data => this.renderStl(data),
      obj: data => this.renderObj(data),
    };

    if (renderTypes[fileType]) {
      renderTypes[fileType](parsedData);
    }
  }

  renderScene() {
    const { gridColor, centerLineColor } = this.theme;

    this.renderer = ThreeRenderer({
      antialias: true,
      shadowMap: true,
    });

    this.scene = ThreeScene({
      showFog: true,
      ...this.theme,
    });

    const viewer = this.viewer.current;
    const canvas = this.renderer.domElement;
    const { offsetWidth: width, offsetHeight: height } = viewer;

    // Grid
    this.grid = ThreeGrid({ size: 100, gridColor, centerLineColor });
    this.scene.add(this.grid);

    // Camera
    this.camera = new THREE.PerspectiveCamera(80, width / height, 0.1, 1000);
    this.camera.position.set(-9.5, 14, 11);

    // Controls
    this.controls = this.createOrbitControls(this.camera, canvas);

    // Set viewer size
    this.renderer.setSize(width, height);

    // Create model material
    this.material = new THREE.MeshPhongMaterial({
      opacity: 1,
      transparent: true,
      // depthWrite: true,
      vertexColors: THREE.FaceColors,
      // Positive value pushes polygon further away
      // polygonOffsetFactor: 1,
      // polygonOffsetUnits: 1,
    });
    // Set material color
    this.material.color.set(this.materialColors.green);

    // Load file and render mesh
    this.startLoader();

    const updateScene = () => {
      requestAnimationFrame(updateScene);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    updateScene();
    // Append canvas
    viewer.appendChild(canvas);
  }

  render() {
    const { error, isReady, isLoading } = this.state;
    const loadingMessage = 'Loading 3D model.';
    const showViewer = isReady && !error;
    const showLoading = isLoading && !error;

    return (
      <React.Fragment>
        {error && <LoadingScreen status={error} spinner={false} />}
        {showLoading && <LoadingScreen status={loadingMessage} spinner />}
        <div
          style={{ opacity: showViewer ? 1 : 0 }}
          className="three-viewer file-render__viewer"
          ref={this.viewer}
        />
      </React.Fragment>
    );
  }
}

export default ThreeViewer;
